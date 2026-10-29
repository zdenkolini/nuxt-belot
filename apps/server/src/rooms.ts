import { rooms, user, type Db } from '@belot/db';
import { eq, inArray, sql } from 'drizzle-orm';
import { targetScores, type TargetScore } from '@belot/engine';
import { Elysia, status, t } from 'elysia';
import { botIds, botMove, createBots, isBot } from '#src/bots';
import { createChat } from '#src/chat';
import type { SocketHandlers } from '#src/modules/sockets/index';
import type {
  RoomMessage,
  Socket,
  Sockets,
} from '#src/modules/sockets/service';
import { createPlay } from '#src/play';
import type { Session } from '#src/plugins/session';

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
  // Usernames of the seated players, in seat order.
  players: (string | null)[];
};

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
    if (id && id !== room.ownerId && !isBot(id)) return id;
  }
  return room.members.find((id) => id !== room.ownerId && !isBot(id));
};

export const createRooms = async (db: Db, bots: boolean, sockets: Sockets) => {
  if (bots) await createBots(db);
  const chat = createChat(sockets);
  const play = await createPlay(db, sockets.connected);

  // A bot whose turn it is plays after a short pause, and so on, until a
  // person is to play or the match is paused or over.
  const thinking = new Set<string>();
  const runBots = (roomId: string) => {
    if (!bots || thinking.has(roomId)) return;
    const turn = [...play.viewsOf(roomId)].find(
      ([userId, message]) =>
        isBot(userId) &&
        message.type === 'match' &&
        message.match.legalMoves.length > 0 &&
        message.match.missing.length === 0,
    );
    if (!turn) return;
    thinking.add(roomId);
    setTimeout(async () => {
      thinking.delete(roomId);
      const [userId, message] = turn;
      if (message.type !== 'match') return;
      const done = await play.move(
        { roomId, userId },
        botMove(message.match.legalMoves),
      );
      if (done.ok) sendMatch(roomId, done.views);
    }, 700);
  };

  const sendMatch = (roomId: string, messages: Map<string, RoomMessage>) => {
    sockets.sendEach(roomId, messages);
    runBots(roomId);
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
    const message: RoomMessage = { type: 'room', room };
    sockets.sendEach(
      room.id,
      new Map(room.members.map((m) => [m.id, message])),
    );
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
        return {
          ok: false,
          failure: status(404, { error: 'room_not_found' as const }),
        } as const;
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
    room.members.includes(userId)
      ? undefined
      : status(403, { error: 'not_a_member' as const });

  const notOwner = (room: Room, userId: string) =>
    room.ownerId === userId
      ? undefined
      : status(403, { error: 'not_the_owner' as const });

  const matchRunning = (room: Room) =>
    play.isRunning(room.id)
      ? status(409, { error: 'match_running' as const })
      : undefined;

  const leave = (room: Room, userId: string) => {
    if (room.ownerId === userId) {
      const owner = nextOwner(room);
      if (owner) room.ownerId = owner;
    }
    room.members = room.members.filter((id) => id !== userId);
    room.seats = room.seats.map((id) => (id === userId ? null : id));
    // A room with only bots left is gone.
    if (room.members.every(isBot)) room.members = [];
  };

  const roomsWith = (
    column: typeof rooms.seats | typeof rooms.members,
    userId: string,
  ) =>
    db
      .select()
      .from(rooms)
      .where(sql`${column} @> ${JSON.stringify([userId])}::jsonb`);

  // The room where the user holds a seat; a player holds at most one.
  const seatedRoom = async (userId: string) =>
    (await roomsWith(rooms.seats, userId))[0];

  // Leaving a match still in play abandons it.
  const leaveRoom = async (id: string, userId: string) => {
    if (play.seatOf({ roomId: id, userId }) !== undefined) {
      sendMatch(id, await play.abandon({ roomId: id, userId }));
    }
    const result = await update(id, (room) => {
      const failure = notMember(room, userId);
      if (failure) return failure;
      leave(room, userId);
    });
    if (result.ok) sockets.close({ roomId: id, userId });
    return result;
  };

  const routes = (session: Session) =>
    new Elysia({ prefix: '/rooms' })
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
          const seated = list.flatMap(({ room }) =>
            room.seats.filter((id) => id !== null),
          );
          const names = new Map(
            (
              await db
                .select({ id: user.id, username: user.username })
                .from(user)
                .where(inArray(user.id, seated))
            ).map((u) => [u.id, u.username]),
          );
          return list.map(({ room, owner }) => ({
            id: room.id,
            owner,
            targetScore: room.targetScore,
            players: room.seats
              .filter((id) => id !== null)
              .map((id) => names.get(id) ?? null),
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
              return status(403, { error: 'removed_from_room' as const });
            if (!room.members.includes(userId)) room.members.push(userId);
          });
          return result.ok ? result.room : result.failure;
        },
        {
          player: true,
          params: t.Object({ id: t.String({ format: 'uuid' }) }),
        },
      )
      .post(
        '/:id/leave',
        async ({ userId, params: { id } }) => {
          const result = await leaveRoom(id, userId);
          return result.ok ? { left: true } : result.failure;
        },
        {
          player: true,
          params: t.Object({ id: t.String({ format: 'uuid' }) }),
        },
      )
      .put(
        '/:id/seat',
        async ({ userId, params: { id }, body: { seat } }) => {
          const before = await seatedRoom(userId);
          const elsewhere = before?.id === id ? undefined : before;
          if (elsewhere && play.isRunning(elsewhere.id)) {
            return status(409, {
              error: 'seated_in_match' as const,
              roomId: elsewhere.id,
            });
          }
          const result = await update(id, (room) => {
            const failure = notMember(room, userId) ?? matchRunning(room);
            if (failure) return failure;
            const taken = room.seats[seat];
            if (taken && taken !== userId)
              return status(409, { error: 'seat_taken' as const });
            room.seats = room.seats.map((s, i) => {
              if (i === seat) return userId;
              if (s === userId) return null;
              return s;
            });
          });
          if (!result.ok) return result.failure;
          // One seat per player: the old seat is freed, and a player not
          // connected to the old room is no longer in it.
          if (elsewhere) {
            await update(elsewhere.id, (room) => {
              room.seats = room.seats.map((s) => (s === userId ? null : s));
              if (!sockets.connected(room.id).has(userId)) leave(room, userId);
            });
          }
          return result.room;
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
        {
          player: true,
          params: t.Object({ id: t.String({ format: 'uuid' }) }),
        },
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
              return status(404, { error: 'member_not_found' as const });
            }
            leave(room, member);
            room.removed.push(member);
          });
          if (!result.ok) return result.failure;
          const removed = { roomId: id, userId: member };
          sockets.sendTo(removed, { type: 'removed' });
          sockets.close(removed);
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
        '/:id/bots',
        async ({ userId, params: { id }, body: { seat } }) => {
          if (!bots) return status(404, { error: 'bots_disabled' as const });
          const result = await update(id, (room) => {
            const failure = notOwner(room, userId) ?? matchRunning(room);
            if (failure) return failure;
            if (room.seats[seat])
              return status(409, { error: 'seat_taken' as const });
            const bot = botIds.find((b) => !room.members.includes(b));
            if (!bot) return status(409, { error: 'no_bot_left' as const });
            room.members.push(bot);
            room.seats[seat] = bot;
          });
          return result.ok ? result.room : result.failure;
        },
        {
          player: true,
          params: t.Object({ id: t.String({ format: 'uuid' }) }),
          body: t.Object({ seat: t.Integer({ minimum: 0, maximum: 3 }) }),
        },
      )
      .post(
        '/:id/start',
        async ({ userId, params: { id } }) => {
          const result = await update(id, (room) => {
            const failure = notOwner(room, userId);
            if (failure) return failure;
            if (room.seats.includes(null))
              return status(409, { error: 'seats_not_full' as const });
            return matchRunning(room);
          });
          if (!result.ok) return result.failure;
          const { seats, targetScore } = result.room!;
          sendMatch(
            id,
            await play.start(id, seats as string[], { targetScore }),
          );
          return { started: true };
        },
        {
          player: true,
          params: t.Object({ id: t.String({ format: 'uuid' }) }),
        },
      );

  // A rejected move or end goes back to the socket that sent it.
  const answer = (
    socket: Socket,
    done: Awaited<ReturnType<typeof play.move | typeof play.end>>,
  ) => {
    if (done.ok) sendMatch(socket.roomId, done.views);
    else socket.send({ type: 'match.rejected', reason: done.reason });
  };

  const socketHandlers: SocketHandlers = {
    room: async ({ roomId, userId }) => {
      const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
      if (!room || !room.members.includes(userId)) return undefined;
      return view(room);
    },
    opened: (socket) => {
      // A seated player coming back may end the pause for everyone.
      if (play.seatOf(socket) !== undefined) {
        sendMatch(socket.roomId, play.viewsOf(socket.roomId));
        return;
      }
      const match = play.viewFor(socket);
      if (match) socket.send(match);
    },
    move: async (socket, move) => answer(socket, await play.move(socket, move)),
    end: async (socket) => answer(socket, await play.end(socket)),
    chat: chat.handle,
    lastClosed: async (member) => {
      // A seated player gone pauses the match for everyone.
      if (play.seatOf(member) !== undefined) {
        sockets.sendEach(member.roomId, play.viewsOf(member.roomId));
        return;
      }
      // A spectator is in a room only while connected to it.
      await update(member.roomId, (room) => {
        if (
          !room.members.includes(member.userId) ||
          room.seats.includes(member.userId)
        )
          return 'stays';
        leave(room, member.userId);
      });
    },
  };

  return {
    routes,
    socketHandlers,

    // The user's seated room: its owner, who names it, its filled seats, and
    // whether a match is running there.
    seated: async (userId: string) => {
      const room = await seatedRoom(userId);
      if (!room) return null;
      const [owner] = await db
        .select({ username: user.username })
        .from(user)
        .where(eq(user.id, room.ownerId));
      return {
        id: room.id,
        owner: owner?.username ?? null,
        seatsFilled: room.seats.filter((id) => id !== null).length,
        matchRunning: play.isRunning(room.id),
      };
    },

    // Takes the user out of every room they are in.
    leaveAll: async (userId: string) => {
      for (const room of await roomsWith(rooms.members, userId)) {
        await leaveRoom(room.id, userId);
      }
    },
  };
};
