import assert from 'node:assert';
import { user, type Db } from '@belot/db';
import type { BelotMove } from '@belot/engine';
import {
  MatchRejected,
  type MatchMessage,
  type Matches,
} from '#src/modules/matches/service';
import type { Sockets } from '#src/modules/sockets/service';
import { Conflict } from '#src/plugins/errors';

// Bots fill seats so one person can test the flows of a match. They are
// users with fixed ids; their usernames have a space, which no person can pick.
export const botIds = ['bot-1', 'bot-2', 'bot-3'] as const;

export const isBot = (userId: string) => userId.startsWith('bot-');

const saveBots = (db: Db) =>
  db
    .insert(user)
    .values(
      botIds.map((id, i) => ({
        id,
        name: `Bot ${i + 1}`,
        email: `${id}@bots.invalid`,
        username: `Bot ${i + 1}`,
      })),
    )
    .onConflictDoNothing();

// Passes when it may, else any legal move.
export const botMove = (legal: BelotMove[]) => {
  const move =
    legal.find((move) => move.type === 'pass') ??
    legal[Math.floor(Math.random() * legal.length)];
  assert(move);
  return move;
};

export const seatBot = (
  room: { members: string[]; seats: (string | null)[] },
  seat: number,
) => {
  if (room.seats[seat]) throw new Conflict('seat_taken');
  const bot = botIds.find((b) => !room.members.includes(b));
  if (!bot) throw new Conflict('no_bot_left');
  room.members.push(bot);
  room.seats[seat] = bot;
};

export const botTurn = (messages: Map<string, MatchMessage>) => {
  for (const [userId, message] of messages) {
    if (
      isBot(userId) &&
      message.type === 'match' &&
      message.match.legalMoves.length > 0 &&
      message.match.missing.length === 0
    ) {
      return { userId, legalMoves: message.match.legalMoves };
    }
  }
  return undefined;
};

export const createBots = async (
  db: Db,
  enabled: boolean,
  matches: Matches,
  sockets: Sockets,
) => {
  if (enabled) await saveBots(db);

  // A bot whose turn it is plays after a short pause, and so on, until a
  // person is to play or the match is paused or over.
  const thinking = new Set<string>();
  const play = (roomId: string) => {
    if (!enabled || thinking.has(roomId)) return;
    const turn = botTurn(matches.viewsOf(roomId));
    if (!turn) return;
    thinking.add(roomId);
    setTimeout(async () => {
      thinking.delete(roomId);
      const move = botMove(turn.legalMoves);
      try {
        const messages = await matches.move(
          { roomId, userId: turn.userId },
          move,
        );
        sockets.sendEach(roomId, messages);
        play(roomId);
      } catch (e) {
        // The match may have paused meanwhile.
        if (!(e instanceof MatchRejected)) throw e;
      }
    }, 700);
  };

  return { enabled, play };
};

export type Bots = Awaited<ReturnType<typeof createBots>>;
