import { rooms, user, type Db } from '@belot/db';
import { eq, inArray } from 'drizzle-orm';
import { targetScores, type TargetScore } from '@belot/engine';
import { Elysia, status, t } from 'elysia';
import { createChat, type ChatIntent, type ChatServerMessage } from './chat';
import { createPlay, type MatchIntent, type MatchMessage } from './play';
import type { Member, Session } from './session';

type Room = typeof rooms.$inferSelect;

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
  | { type: 'room'; room: RoomView }
  | { type: 'removed' }
  | MatchMessage
  | ChatServerMessage;

type Socket = Member & {
  send: (message: RoomMessage) => void;
  close: () => void;
};

const fail = <Code extends 403 | 404 | 409, Error extends string>(
  code: Code,
  error: Error,
) => status(code, { error });

// t.UnionEnum would default a missing target score to 501.
const targetScore = t.Union(
  targetScores.map((score) => t.Literal(score)) as [
    ReturnType<typeof t.Literal<TargetScore>>,
  ],
);

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

export const roomRoutes = async (db: Db, session: Session) => {
  // Open room sockets by room id, then by connection id.
  const sockets = new Map<string, Map<string, Socket>>();
  const chat = createChat();
  const play = await createPlay(
    db,
    (roomId) =>
      new Set([...(sockets.get(roomId)?.values() ?? [])].map((s) => s.userId)),
  );

  // Sends each user their own message, if they have one.
  const sendEach = (roomId: string, messages: Map<string, RoomMessage>) => {
    for (const socket of sockets.get(roomId)?.values() ?? []) {
      const message = messages.get(socket.userId);
      if (message) socket.send(message);
    }
  };

  const view = async (room: Room): Promise<RoomView> => {
    const names = await db
      .select({ id: user.id, username: user.username })
      .from(user)
      .where(inArray(user.id, room.members));
    return {
      id: room.id,
      ownerId: room.ownerId,
      isPublic: room.isPublic,
      targetScore: room.targetScore,
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
  // The room is null when the last member left and the room is gone.
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
      if (!room) {
        return { ok: false, failure: fail(404, 'room_not_found') } as const;
      }
      const failure = change(room);
      if (failure) return { ok: false, failure } as const;
      if (room.members.length === 0) {
        await tx.delete(rooms).where(eq(rooms.id, id));
        return { ok: true, room: null } as const;
      }
      await tx.update(rooms).set(room).where(eq(rooms.id, id));
      return { ok: true, room } as const;
    });
    if (!result.ok) return result;
    if (!result.room) {
      chat.forget(id);
      return { ok: true, room: null } as const;
    }
    const roomView = await view(result.room);
    broadcast(roomView);
    return { ok: true, room: roomView } as const;
  };

  const notMember = (room: Room, userId: string) =>
    room.members.includes(userId) ? undefined : fail(403, 'not_a_member');

  const notOwner = (room: Room, userId: string) =>
    room.ownerId === userId ? undefined : fail(403, 'not_the_owner');

  const matchRunning = (room: Room) =>
    play.isRunning(room.id) ? fail(409, 'match_running') : undefined;

  const leave = (room: Room, userId: string) => {
    if (room.ownerId === userId) {
      const owner = nextOwner(room);
      if (owner) room.ownerId = owner;
    }
    room.members = room.members.filter((id) => id !== userId);
    room.seats = room.seats.map((id) => (id === userId ? null : id));
  };

  // Opening a socket reads the room first. Messages and the close that come
  // meanwhile wait for it, by connection id.
  const opening = new Map<string, Promise<void>>();

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
          targetScore: room.targetScore,
          freeSeats: room.seats.filter((id) => id === null).length,
        }));
      },
      { player: true },
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
      { player: true },
    )
    .post(
      '/:id/join',
      async ({ userId, params: { id } }) => {
        const result = await update(id, (room) => {
          if (room.removed.includes(userId))
            return fail(403, 'removed_from_room');
          if (!room.members.includes(userId)) room.members.push(userId);
          // A player who left mid-match takes their seat back.
          const seat = play.seatOf({ roomId: room.id, userId });
          if (seat !== undefined) room.seats[seat] = userId;
        });
        return result.ok ? result.room : result.failure;
      },
      { player: true, params: t.Object({ id: t.String({ format: 'uuid' }) }) },
    )
    .post(
      '/:id/leave',
      async ({ userId, params: { id } }) => {
        const result = await update(id, (room) => {
          const failure = notMember(room, userId);
          if (failure) return failure;
          leave(room, userId);
        });
        if (!result.ok) return result.failure;
        disconnect(id, userId);
        return { left: true };
      },
      { player: true, params: t.Object({ id: t.String({ format: 'uuid' }) }) },
    )
    .put(
      '/:id/seat',
      async ({ userId, params: { id }, body: { seat } }) => {
        const result = await update(id, (room) => {
          const failure = notMember(room, userId) ?? matchRunning(room);
          if (failure) return failure;
          const taken = room.seats[seat];
          if (taken && taken !== userId) return fail(409, 'seat_taken');
          room.seats = room.seats.map((s, i) =>
            i === seat ? userId : s === userId ? null : s,
          );
        });
        return result.ok ? result.room : result.failure;
      },
      {
        player: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: t.Object({ seat: t.Integer({ minimum: 0, maximum: 3 }) }),
      },
    )
    .delete(
      '/:id/seat',
      async ({ userId, params: { id } }) => {
        const result = await update(id, (room) => {
          const failure = notMember(room, userId) ?? matchRunning(room);
          if (failure) return failure;
          room.seats = room.seats.map((s) => (s === userId ? null : s));
        });
        return result.ok ? result.room : result.failure;
      },
      { player: true, params: t.Object({ id: t.String({ format: 'uuid' }) }) },
    )
    .patch(
      '/:id',
      async ({ userId, params: { id }, body }) => {
        const result = await update(id, (room) => {
          const failure = notOwner(room, userId);
          if (failure) return failure;
          if (body.isPublic !== undefined) room.isPublic = body.isPublic;
          if (body.targetScore !== undefined)
            room.targetScore = body.targetScore;
        });
        return result.ok ? result.room : result.failure;
      },
      {
        player: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: t.Object({
          isPublic: t.Optional(t.Boolean()),
          targetScore: t.Optional(targetScore),
        }),
      },
    )
    .delete(
      '/:id/members/:userId',
      async ({ userId, params: { id, userId: member } }) => {
        const result = await update(id, (room) => {
          const failure = notOwner(room, userId);
          if (failure) return failure;
          if (member === userId || !room.members.includes(member)) {
            return fail(404, 'member_not_found');
          }
          leave(room, member);
          room.removed.push(member);
        });
        if (!result.ok) return result.failure;
        disconnect(id, member, { type: 'removed' });
        return result.room;
      },
      {
        player: true,
        params: t.Object({
          id: t.String({ format: 'uuid' }),
          userId: t.String(),
        }),
      },
    )
    .post(
      '/:id/start',
      async ({ userId, params: { id } }) => {
        const result = await update(id, (room) => {
          const failure = notOwner(room, userId);
          if (failure) return failure;
          if (room.seats.includes(null)) return fail(409, 'seats_not_full');
          return matchRunning(room);
        });
        if (!result.ok) return result.failure;
        const { seats, targetScore } = result.room!;
        sendEach(id, await play.start(id, seats as string[], { targetScore }));
        return { started: true };
      },
      { player: true, params: t.Object({ id: t.String({ format: 'uuid' }) }) },
    )
    .ws('/:id/ws', {
      player: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      open(ws) {
        const { userId, params } = ws.data;
        const open = async () => {
          const [room] = await db
            .select()
            .from(rooms)
            .where(eq(rooms.id, params.id));
          if (!room || !room.members.includes(userId))
            return ws.close(4403, 'not_a_member');
          const socket: Socket = {
            roomId: params.id,
            userId,
            send: (message) => ws.send(JSON.stringify(message)),
            close: () => ws.close(),
          };
          const roomSockets = sockets.get(params.id) ?? new Map();
          sockets.set(params.id, roomSockets.set(ws.id, socket));
          socket.send({ type: 'room', room: await view(room) });
          // A seated player coming back may end the pause for everyone.
          if (play.seatOf(socket) !== undefined) {
            sendEach(params.id, play.viewsOf(params.id));
          } else {
            const match = play.viewFor(socket);
            if (match) socket.send(match);
          }
        };
        const opened = open();
        opening.set(ws.id, opened);
        return opened;
      },
      async message(ws, body) {
        await opening.get(ws.id);
        // Elysia parses JSON messages; anything else is not an intent.
        const intent = (typeof body === 'object' ? body : null) as Partial<
          ChatIntent | MatchIntent
        > | null;
        const roomSockets = sockets.get(ws.data.params.id);
        const socket = roomSockets?.get(ws.id);
        if (!roomSockets || !socket) return;
        if (intent?.type === 'match.move' || intent?.type === 'match.end') {
          const done =
            intent.type === 'match.move'
              ? await play.move(socket, intent.move ?? {})
              : await play.end(socket);
          if (done.ok) sendEach(socket.roomId, done.views);
          else socket.send({ type: 'match.rejected', reason: done.reason });
        } else if (String(intent?.type).startsWith('chat.')) {
          chat.handle(socket, intent as ChatIntent, [...roomSockets.values()]);
        }
      },
      async close(ws) {
        const { userId, params } = ws.data;
        await opening.get(ws.id);
        opening.delete(ws.id);
        sockets.get(params.id)?.delete(ws.id);
        // A seated player gone pauses the match for everyone.
        if (play.seatOf({ roomId: params.id, userId }) !== undefined) {
          sendEach(params.id, play.viewsOf(params.id));
        }
      },
    });
};
