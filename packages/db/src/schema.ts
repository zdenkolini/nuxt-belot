import type { TargetScore } from '@belot/engine';
import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Members, seats and removed hold user ids; seats is indexed by seat 0-3.
export const rooms = pgTable('rooms', {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: timestamp().notNull().defaultNow(),
  ownerId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  isPublic: boolean().notNull().default(false),
  targetScore: integer().$type<TargetScore>().notNull().default(1001),
  members: jsonb().$type<string[]>().notNull(),
  seats: jsonb().$type<(string | null)[]>().notNull(),
  removed: jsonb().$type<string[]>().notNull().default([]),
});

// One match of a ruleset. Seats holds a user id per seat 0-3. The seed is
// 128 bits as 32 hex digits and must not reach clients before the match is over.
export const matches = pgTable('matches', {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: timestamp().notNull().defaultNow(),
  roomId: uuid().references(() => rooms.id, { onDelete: 'set null' }),
  ruleset: text().notNull(),
  variant: jsonb().notNull(),
  seats: jsonb().$type<string[]>().notNull(),
  seed: text().notNull(),
  // running, finished (a team won), or ended (players ended it while paused).
  status: text().notNull().default('running'),
  result: jsonb(),
});

// The accepted moves of a match; replaying them in order rebuilds it.
export const moves = pgTable(
  'moves',
  {
    matchId: uuid()
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    index: integer().notNull(),
    seat: integer().notNull(),
    move: jsonb().notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.index] })],
);

// One row per claim, kept for analysis. Ids are not foreign keys: the guest is
// deleted after the claim. Existing means the account already had a username,
// so it could have its own match history. Choice is new, kept_account, or
// merged; null while a claim into an existing account waits for the player.
export const claims = pgTable('claims', {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: timestamp().notNull().defaultNow(),
  guestId: text().notNull(),
  accountId: text().notNull(),
  existing: boolean().notNull(),
  choice: text(),
  guestMatches: integer().notNull(),
  skipped: integer().notNull().default(0),
  decidedAt: timestamp(),
});

// Better Auth tables: user, session, account, verification.
export const user = pgTable(
  'user',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    username: text(),
    usernameChangedAt: timestamp(),
    isAnonymous: boolean(),
  },
  (t) => [uniqueIndex('user_username_lower').on(sql`lower(${t.username})`)],
);

export const session = pgTable('session', {
  id: text().primaryKey(),
  expiresAt: timestamp().notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp(),
  refreshTokenExpiresAt: timestamp(),
  scope: text(),
  password: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});
