import assert from 'node:assert';
import { rooms, user, type Db } from '@belot/db';
import { eq } from 'drizzle-orm';
import type { TargetScore } from '@belot/engine';
import { botIds, botMove, createBots, isBot } from '#src/bots';
import { createChat } from '#src/chat';
import { holdsUser, usernames } from '#src/modules/account/service';
import { createMatches, MatchRejected } from '#src/modules/matches/service';
import type { Settings } from '#src/modules/rooms/model';
import type { SocketHandlers } from '#src/modules/sockets/index';
import type {
  RoomMessage,
  Socket,
  Sockets,
} from '#src/modules/sockets/service';
import { Conflict, Forbidden, HttpError, NotFound } from '#src/plugins/errors';

export type Room = typeof rooms.$inferSelect;

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

// The next seated player counter-clockwise from the owner's seat, else the
// longest-staying member.
export const nextOwner = (room: Room) => {
  const from = room.seats.indexOf(room.ownerId);
  for (let i = 1; i <= 4; i++) {
    const id = room.seats[(from + i + 4) % 4];
    if (id && id !== room.ownerId && !isBot(id)) return id;
  }
  return room.members.find((id) => id !== room.ownerId && !isBot(id));
};

export const leave = (room: Room, userId: string) => {
  if (room.ownerId === userId) {
    const owner = nextOwner(room);
    if (owner) room.ownerId = owner;
  }
  room.members = room.members.filter((id) => id !== userId);
  freeSeat(room, userId);
  // A room with only bots left is gone.
  if (room.members.every(isBot)) room.members = [];
};

export const addMember = (room: Room, userId: string) => {
  if (room.removed.includes(userId)) throw new Forbidden('removed_from_room');
  if (!room.members.includes(userId)) room.members.push(userId);
};

export const assertMember = (room: Room, userId: string) => {
  if (!room.members.includes(userId)) throw new Forbidden('not_a_member');
};

export const assertOwner = (room: Room, userId: string) => {
  if (room.ownerId !== userId) throw new Forbidden('not_the_owner');
};

export const takeSeat = (room: Room, userId: string, seat: number) => {
  const taken = room.seats[seat];
  if (taken && taken !== userId) throw new Conflict('seat_taken');
  room.seats = room.seats.map((s, i) => {
    if (i === seat) return userId;
    if (s === userId) return null;
    return s;
  });
};

export const freeSeat = (room: Room, userId: string) => {
  room.seats = room.seats.map((s) => (s === userId ? null : s));
};

export const removeMember = (room: Room, member: string) => {
  if (member === room.ownerId || !room.members.includes(member)) {
    throw new NotFound('member_not_found');
  }
  leave(room, member);
  room.removed.push(member);
};

export const seatBot = (room: Room, seat: number) => {
  if (room.seats[seat]) throw new Conflict('seat_taken');
  const bot = botIds.find((b) => !room.members.includes(b));
  if (!bot) throw new Conflict('no_bot_left');
  room.members.push(bot);
  room.seats[seat] = bot;
};

export const seatedPlayers = (room: { seats: (string | null)[] }) => {
  const players = room.seats.filter((id) => id !== null);
  if (players.length < room.seats.length) throw new Conflict('seats_not_full');
  return players;
};

export const createRooms = async (db: Db, bots: boolean, sockets: Sockets) => {
  if (bots) await createBots(db);
  const chat = createChat(sockets);
  const matches = await createMatches(db, sockets.connected);

  // A bot whose turn it is plays after a short pause, and so on, until a
  // person is to play or the match is paused or over.
  const thinking = new Set<string>();
  const runBots = (roomId: string) => {
    if (!bots || thinking.has(roomId)) return;
    const turn = [...matches.viewsOf(roomId)].find(
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
      const move = botMove(message.match.legalMoves);
      try {
        sendMatch(roomId, await matches.move({ roomId, userId }, move));
      } catch (e) {
        // The match may have paused meanwhile.
        if (!(e instanceof MatchRejected)) throw e;
      }
    }, 700);
  };

  const sendMatch = (roomId: string, messages: Map<string, RoomMessage>) => {
    sockets.sendEach(roomId, messages);
    runBots(roomId);
  };

  const view = async (room: Room): Promise<RoomView> => {
    const names = await usernames(db, room.members);
    return {
      id: room.id,
      ownerId: room.ownerId,
      isPublic: room.isPublic,
      targetScore: room.targetScore,
      members: room.members.map((id) => ({
        id,
        username: names.get(id) ?? null,
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

  // Changes one room in a transaction, then sends the new room to everyone in
  // it. `edit` mutates the room, throws to reject the request, or returns
  // false to keep the room as it is. Gives null when the room is kept as it
  // is, or is gone because its last member left.
  const update = async (id: string, edit: (room: Room) => void | false) => {
    const room = await db.transaction(async (tx) => {
      const [room] = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.id, id))
        .for('update');
      if (!room) throw new NotFound('room_not_found');
      if (edit(room) === false) return undefined;
      if (room.members.length === 0) {
        await tx.delete(rooms).where(eq(rooms.id, id));
        return null;
      }
      await tx.update(rooms).set(room).where(eq(rooms.id, id));
      return room;
    });
    if (room === null) chat.forget(id);
    if (!room) return null;
    const roomView = await view(room);
    broadcast(roomView);
    return roomView;
  };

  // Updates that no request waits on drop a rejection, as the room was
  // deleted or changed meanwhile.
  const quietly = (updated: Promise<unknown>) =>
    updated.catch((e: unknown) => {
      if (!(e instanceof HttpError)) throw e;
    });

  const assertNoMatch = (room: Room) => {
    if (matches.isRunning(room.id)) throw new Conflict('match_running');
  };

  const roomsWith = (
    column: typeof rooms.seats | typeof rooms.members,
    userId: string,
  ) => db.select().from(rooms).where(holdsUser(column, userId));

  // The room where the user holds a seat; a player holds at most one.
  const seatedRoom = async (userId: string) =>
    (await roomsWith(rooms.seats, userId))[0];

  const seatedElsewhere = async (userId: string, id: string) => {
    const room = await seatedRoom(userId);
    if (room?.id === id) return undefined;
    return room;
  };

  // Leaving a match still in play abandons it.
  const leaveRoom = async (id: string, userId: string) => {
    if (matches.seatOf({ roomId: id, userId }) !== undefined) {
      sendMatch(id, await matches.abandon({ roomId: id, userId }));
    }
    await update(id, (room) => {
      assertMember(room, userId);
      leave(room, userId);
    });
    sockets.close({ roomId: id, userId });
  };

  // A rejected move or end goes back to the socket that sent it.
  const answer = async (
    socket: Socket,
    done: Promise<Map<string, RoomMessage>>,
  ) => {
    try {
      sendMatch(socket.roomId, await done);
    } catch (e) {
      if (!(e instanceof MatchRejected)) throw e;
      socket.send({ type: 'match.rejected', reason: e.code });
    }
  };

  const socketHandlers: SocketHandlers = {
    room: async ({ roomId, userId }) => {
      const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
      if (!room || !room.members.includes(userId)) return undefined;
      return view(room);
    },
    opened: (socket) => {
      // A seated player coming back may end the pause for everyone.
      if (matches.seatOf(socket) !== undefined) {
        sendMatch(socket.roomId, matches.viewsOf(socket.roomId));
        return;
      }
      const match = matches.viewFor(socket);
      if (match) socket.send(match);
    },
    move: (socket, move) => answer(socket, matches.move(socket, move)),
    end: (socket) => answer(socket, matches.end(socket)),
    chat: chat.handle,
    lastClosed: async (member) => {
      // A seated player gone pauses the match for everyone.
      if (matches.seatOf(member) !== undefined) {
        sockets.sendEach(member.roomId, matches.viewsOf(member.roomId));
        return;
      }
      // A spectator is in a room only while connected to it.
      await quietly(
        update(member.roomId, (room) => {
          if (
            !room.members.includes(member.userId) ||
            room.seats.includes(member.userId)
          )
            return false;
          leave(room, member.userId);
        }),
      );
    },
  };

  return {
    socketHandlers,

    list: async (): Promise<PublicRoom[]> => {
      const list = await db
        .select({ room: rooms, owner: user.username })
        .from(rooms)
        .innerJoin(user, eq(user.id, rooms.ownerId))
        .where(eq(rooms.isPublic, true))
        .orderBy(rooms.createdAt);
      const names = await usernames(
        db,
        list.flatMap(({ room }) => room.seats.filter((id) => id !== null)),
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

    create: async (userId: string) => {
      const [room] = await db
        .insert(rooms)
        .values({
          ownerId: userId,
          members: [userId],
          seats: [null, null, null, null],
        })
        .returning();
      assert(room);
      return view(room);
    },

    join: (id: string, userId: string) =>
      update(id, (room) => addMember(room, userId)),

    leave: async (id: string, userId: string) => {
      await leaveRoom(id, userId);
      return { left: true };
    },

    takeSeat: async (id: string, userId: string, seat: number) => {
      const elsewhere = await seatedElsewhere(userId, id);
      if (elsewhere && matches.isRunning(elsewhere.id)) {
        throw new Conflict('seated_in_match');
      }
      const room = await update(id, (room) => {
        assertMember(room, userId);
        assertNoMatch(room);
        takeSeat(room, userId, seat);
      });
      // One seat per player: the old seat is freed, and a player not
      // connected to the old room is no longer in it.
      if (elsewhere) {
        await quietly(
          update(elsewhere.id, (room) => {
            freeSeat(room, userId);
            if (!sockets.connected(room.id).has(userId)) leave(room, userId);
          }),
        );
      }
      return room;
    },

    freeSeat: (id: string, userId: string) =>
      update(id, (room) => {
        assertMember(room, userId);
        assertNoMatch(room);
        freeSeat(room, userId);
      }),

    change: (id: string, userId: string, settings: Settings) =>
      update(id, (room) => {
        assertOwner(room, userId);
        if (settings.isPublic !== undefined) room.isPublic = settings.isPublic;
        if (settings.targetScore !== undefined) {
          room.targetScore = settings.targetScore;
        }
      }),

    removeMember: async (id: string, userId: string, member: string) => {
      const room = await update(id, (room) => {
        assertOwner(room, userId);
        removeMember(room, member);
      });
      const removed = { roomId: id, userId: member };
      sockets.sendTo(removed, { type: 'removed' });
      sockets.close(removed);
      return room;
    },

    addBot: (id: string, userId: string, seat: number) => {
      if (!bots) throw new NotFound('bots_disabled');
      return update(id, (room) => {
        assertOwner(room, userId);
        assertNoMatch(room);
        seatBot(room, seat);
      });
    },

    start: async (id: string, userId: string) => {
      const room = await update(id, (room) => {
        assertOwner(room, userId);
        seatedPlayers(room);
        assertNoMatch(room);
      });
      assert(room);
      const { targetScore } = room;
      sendMatch(
        id,
        await matches.start(id, seatedPlayers(room), { targetScore }),
      );
      return { started: true };
    },

    // The user's seated room: its owner, who names it, its filled seats, and
    // whether a match is running there.
    seated: async (userId: string) => {
      const room = await seatedRoom(userId);
      if (!room) return null;
      const names = await usernames(db, [room.ownerId]);
      return {
        id: room.id,
        owner: names.get(room.ownerId) ?? null,
        seatsFilled: room.seats.filter((id) => id !== null).length,
        matchRunning: matches.isRunning(room.id),
      };
    },

    // Takes the user out of every room they are in.
    leaveAll: async (userId: string) => {
      for (const room of await roomsWith(rooms.members, userId)) {
        await quietly(leaveRoom(room.id, userId));
      }
    },
  };
};

export type Rooms = Awaited<ReturnType<typeof createRooms>>;
