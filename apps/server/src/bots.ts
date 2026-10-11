import { user, type Db } from '@belot/db';
import type { BelotMove } from '@belot/engine';

// Bots fill seats so one person can test the flows of a match. They are
// users with fixed ids; their usernames have a space, which no person can pick.
export const botIds = ['bot-1', 'bot-2', 'bot-3'] as const;

export const isBot = (userId: string) => userId.startsWith('bot-');

export const createBots = (db: Db) =>
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
export const botMove = (legal: BelotMove[]) =>
  legal.find((move) => move.type === 'pass') ??
  legal[Math.floor(Math.random() * legal.length)]!;
