import { rooms, user, type Db } from '@belot/db';
import { eq, inArray } from 'drizzle-orm';
import { Elysia, status, t } from 'elysia';
import type { Session } from './session';

type Room = typeof rooms.$inferSelect;

export type TargetScore = 501 | 701 | 1001;

export type RoomView = {
  id: string;
  ownerId: string;
  isPublic: boolean;
  targetScore: TargetScore;
  members: { id: string; username: string | null }[];
  // A user id per seat 0-3; seats 0+2 and 1+3 are teams.
  seats: (string | null)[];
};

export type PublicRoom = {
  id: string;
  owner: string | null;
  targetScore: TargetScore;
  freeSeats: number;
};

// Everything the server sends over the room socket.
export type RoomMessage =
  { type: 'room'; room: RoomView } | { type: 'removed' };

type Socket = {
  userId: string;
  send: (message: RoomMessage) => void;
  close: () => void;
};

const fail = <Code extends 403 | 404 | 409, Error extends string>(
  code: Code,
  error: Error,
) => status(code, { error });

// The next seated player counter-clockwise from the owner's seat, else the
// longest-staying member.
const nextOwner = (room: Room) => {
  const from = room.seats.indexOf(room.ownerId);
  for (let i = 1; i <= 4; i++) {
    const id = room.seats[(from + i + 4) % 4];
    if (id && id !== room.ownerId) return id;
  }
  return room.members.find((id) => id !== room.ownerId);
};

export const roomRoutes = (db: Db, session: Session) => {
  // Open room sockets by room id, then by connection id.
  const sockets = new Map<string, Map<string, Socket>>();

  const view = async (room: Room): Promise<RoomView> => {
    const names = await db
      .select({ id: user.id, username: user.username })
      .from(user)
      .where(inArray(user.id, room.members));
    return {
      id: room.id,
      ownerId: room.ownerId,
      isPublic: room.isPublic,
      targetScore: room.targetScore as TargetScore,
      members: room.members.map((id) => ({
        id,
        username: names.find((n) => n.id === id)?.username ?? null,
      })),
      seats: room.seats,
    };
  };

  // Only members get the room, so a player who just left hears nothing more.
  const broadcast = (room: RoomView) => {
    const members = room.members.map((m) => m.id);
    for (const socket of sockets.get(room.id)?.values() ?? []) {
      if (members.includes(socket.userId)) socket.send({ type: 'room', room });
    }
  };

  const disconnect = (
    roomId: string,
    userId: string,
    message?: RoomMessage,
  ) => {
    for (const socket of sockets.get(roomId)?.values() ?? []) {
      if (socket.userId !== userId) continue;
      if (message) socket.send(message);
      socket.close();
    }
  };

  // Changes one room in a transaction, then sends the new room to everyone in it.
  // `change` mutates the room, or returns a failure to reject the request.
  // Gives null when the last member left and the room is gone.
  const update = async <Failure>(
    id: string,
    change: (room: Room) => Failure | void,
  ) => {
    const result = await db.transaction(async (tx) => {
      const [room] = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.id, id))
        .for('update');
      if (!room) return { failure: fail(404, 'room_not_found') };
      const failure = change(room);
      if (failure) return { failure };
      if (room.members.length === 0) {
        await tx.delete(rooms).where(eq(rooms.id, id));
        return null;
      }
      await tx.update(rooms).set(room).where(eq(rooms.id, id));
      return { room };
    });
    if (!result) return null;
    if ('failure' in result) return result.failure;
    const roomView = await view(result.room);
    broadcast(roomView);
    return roomView;
  };

  const notMember = (room: Room, userId: string) =>
    room.members.includes(userId) ? undefined : fail(403, 'not_a_member');

  const notOwner = (room: Room, userId: string) =>
    room.ownerId === userId ? undefined : fail(403, 'not_the_owner');

  const leave = (room: Room, userId: string) => {
    if (room.ownerId === userId) {
      const owner = nextOwner(room);
      if (owner) room.ownerId = owner;
    }
    room.members = room.members.filter((id) => id !== userId);
    room.seats = room.seats.map((id) => (id === userId ? null : id));
  };

  return new Elysia({ prefix: '/rooms' })
    .use(session)
    .get(
      '/',
      async (): Promise<PublicRoom[]> => {
        const list = await db
          .select({ room: rooms, owner: user.username })
          .from(rooms)
          .innerJoin(user, eq(user.id, rooms.ownerId))
          .where(eq(rooms.isPublic, true))
          .orderBy(rooms.createdAt);
        return list.map(({ room, owner }) => ({
          id: room.id,
          owner,
          targetScore: room.targetScore as TargetScore,
          freeSeats: room.seats.filter((id) => id === null).length,
        }));
      },
      { auth: true },
    )
    .post(
      '/',
      async ({ userId }) => {
        const [room] = await db
          .insert(rooms)
          .values({
            ownerId: userId,
            members: [userId],
            seats: [null, null, null, null],
          })
          .returning();
        return view(room!);
      },
      { auth: true },
    )
    .post(
      '/:id/join',
      async ({ userId, params: { id } }) =>
        (await update(id, (room) => {
          if (room.removed.includes(userId))
            return fail(403, 'removed_from_room');
          if (!room.members.includes(userId)) room.members.push(userId);
        }))!,
      { auth: true, params: t.Object({ id: t.String({ format: 'uuid' }) }) },
    )
    .post(
      '/:id/leave',
      async ({ userId, params: { id } }) => {
        const result = await update(id, (room) => {
          const failure = notMember(room, userId);
          if (failure) return failure;
          leave(room, userId);
        });
        if (result && 'code' in result) return result;
        disconnect(id, userId);
        return { left: true };
      },
      { auth: true, params: t.Object({ id: t.String({ format: 'uuid' }) }) },
    )
    .put(
      '/:id/seat',
      async ({ userId, params: { id }, body: { seat } }) =>
        (await update(id, (room) => {
          const failure = notMember(room, userId);
          if (failure) return failure;
          const taken = room.seats[seat];
          if (taken && taken !== userId) return fail(409, 'seat_taken');
          room.seats = room.seats.map((s, i) =>
            i === seat ? userId : s === userId ? null : s,
          );
        }))!,
      {
        auth: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: t.Object({ seat: t.Integer({ minimum: 0, maximum: 3 }) }),
      },
    )
    .delete(
      '/:id/seat',
      async ({ userId, params: { id } }) =>
        (await update(id, (room) => {
          const failure = notMember(room, userId);
          if (failure) return failure;
          room.seats = room.seats.map((s) => (s === userId ? null : s));
        }))!,
      { auth: true, params: t.Object({ id: t.String({ format: 'uuid' }) }) },
    )
    .patch(
      '/:id',
      async ({ userId, params: { id }, body }) =>
        (await update(id, (room) => {
          const failure = notOwner(room, userId);
          if (failure) return failure;
          if (body.isPublic !== undefined) room.isPublic = body.isPublic;
          if (body.targetScore !== undefined)
            room.targetScore = body.targetScore;
        }))!,
      {
        auth: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: t.Object({
          isPublic: t.Optional(t.Boolean()),
          targetScore: t.Optional(
            t.Union([t.Literal(501), t.Literal(701), t.Literal(1001)]),
          ),
        }),
      },
    )
    .delete(
      '/:id/members/:memberId',
      async ({ userId, params: { id, memberId } }) => {
        const result = await update(id, (room) => {
          const failure = notOwner(room, userId);
          if (failure) return failure;
          if (memberId === userId || !room.members.includes(memberId)) {
            return fail(404, 'member_not_found');
          }
          leave(room, memberId);
          room.removed.push(memberId);
        });
        if (!('code' in result!)) disconnect(id, memberId, { type: 'removed' });
        return result!;
      },
      {
        auth: true,
        params: t.Object({
          id: t.String({ format: 'uuid' }),
          memberId: t.String(),
        }),
      },
    )
    .post(
      '/:id/start',
      // A stub until play arrives: it only checks who may start and when.
      async ({ userId, params: { id } }) => {
        const result = await update(id, (room) => {
          const failure = notOwner(room, userId);
          if (failure) return failure;
          if (room.seats.includes(null)) return fail(409, 'seats_not_full');
        });
        if ('code' in result!) return result;
        return { started: true };
      },
      { auth: true, params: t.Object({ id: t.String({ format: 'uuid' }) }) },
    )
    .ws('/:id/ws', {
      auth: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      async open(ws) {
        const { userId, params } = ws.data;
        const [room] = await db
          .select()
          .from(rooms)
          .where(eq(rooms.id, params.id));
        if (!room || !room.members.includes(userId))
          return ws.close(4403, 'not_a_member');
        const socket: Socket = {
          userId,
          send: (message) => ws.send(JSON.stringify(message)),
          close: () => ws.close(),
        };
        const roomSockets = sockets.get(params.id) ?? new Map();
        sockets.set(params.id, roomSockets.set(ws.id, socket));
        socket.send({ type: 'room', room: await view(room) });
      },
      close(ws) {
        sockets.get(ws.data.params.id)?.delete(ws.id);
      },
    });
};
