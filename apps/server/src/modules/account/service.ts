import assert from 'node:assert';
import { claims, matches, user, type Db } from '@belot/db';
import { and, desc, eq, inArray, isNull, sql, type Column } from 'drizzle-orm';
import {
  Conflict,
  Forbidden,
  NotFound,
  TooManyRequests,
} from '#src/plugins/errors';

const usernameChangeInterval = 30 * 24 * 60 * 60 * 1000;

// Drizzle wraps the driver error; Postgres code 23505 is a unique violation.
const isUniqueViolation = (e: unknown) =>
  e instanceof Error &&
  typeof e.cause === 'object' &&
  e.cause !== null &&
  'code' in e.cause &&
  e.cause.code === '23505';

// A jsonb column of user ids holds the user: a match's seats, or a room's
// seats or members.
export const holdsUser = (column: Column, userId: string) =>
  sql`${column} @> ${JSON.stringify([userId])}::jsonb`;

export const usernames = async (db: Db, ids: string[]) =>
  new Map(
    (
      await db
        .select({ id: user.id, username: user.username })
        .from(user)
        .where(inArray(user.id, ids))
    ).map((u) => [u.id, u.username]),
  );

export const me = async (db: Db, userId: string) => {
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      username: user.username,
      isGuest: user.isAnonymous,
    })
    .from(user)
    .where(eq(user.id, userId));
  assert(row);
  return { ...row, isGuest: row.isGuest ?? false };
};

export const matchHistory = (db: Db, userId: string) =>
  db
    .select({ id: matches.id })
    .from(matches)
    .where(holdsUser(matches.seats, userId))
    .orderBy(desc(matches.createdAt));

type RenameState = {
  username: string | null;
  changedAt: Date | null;
  isGuest: boolean | null;
};

// The first pick is free; after that one change per 30 days.
export const checkRename = (state: RenameState, now: Date) => {
  if (state.isGuest) throw new Forbidden('guest_cannot_rename');
  const isChange = state.username !== null;
  if (
    isChange &&
    state.changedAt &&
    now.getTime() - state.changedAt.getTime() < usernameChangeInterval
  ) {
    throw new TooManyRequests('username_change_too_soon');
  }
  return { isChange };
};

export const setUsername = async (db: Db, userId: string, username: string) => {
  const [state] = await db
    .select({
      username: user.username,
      changedAt: user.usernameChangedAt,
      isGuest: user.isAnonymous,
    })
    .from(user)
    .where(eq(user.id, userId));
  assert(state);
  const { isChange } = checkRename(state, new Date());
  try {
    await db
      .update(user)
      .set({ username, ...(isChange && { usernameChangedAt: new Date() }) })
      .where(eq(user.id, userId));
  } catch (e) {
    if (isUniqueViolation(e)) throw new Conflict('username_taken');
    throw e;
  }
  return { username };
};

export const countMatches = async (db: Db, userId: string) =>
  (await matchHistory(db, userId)).length;

// Moves a guest's matches to an account. A match where both sat stays with
// the guest, so no player ends up on both teams.
export const moveMatches = async (
  db: Db,
  guestId: string,
  accountId: string,
) => {
  const list = await db
    .select()
    .from(matches)
    .where(holdsUser(matches.seats, guestId));
  let skipped = 0;
  for (const match of list) {
    if (match.seats.includes(accountId)) {
      skipped++;
      continue;
    }
    await db
      .update(matches)
      .set({
        seats: match.seats.map((id) => (id === guestId ? accountId : id)),
      })
      .where(eq(matches.id, match.id));
  }
  return { skipped };
};

// A claim into an account that has its own history waits here until the
// player chooses which history to keep.
const pendingClaim = async (db: Db, accountId: string) => {
  const [claim] = await db
    .select()
    .from(claims)
    .where(and(eq(claims.accountId, accountId), isNull(claims.choice)));
  return claim;
};

export const claimStatus = async (db: Db, userId: string) => {
  const claim = await pendingClaim(db, userId);
  if (!claim) return { claim: null };
  return {
    claim: {
      guestMatches: claim.guestMatches,
      accountMatches: await countMatches(db, userId),
    },
  };
};

export const decideClaim = async (
  db: Db,
  userId: string,
  choice: 'kept_account' | 'merged',
) => {
  const claim = await pendingClaim(db, userId);
  if (!claim) throw new NotFound('no_pending_claim');
  let skipped = 0;
  if (choice === 'merged') {
    ({ skipped } = await moveMatches(db, claim.guestId, userId));
  }
  await db
    .update(claims)
    .set({ choice, skipped, decidedAt: new Date() })
    .where(eq(claims.id, claim.id));
  await db.delete(user).where(eq(user.id, claim.guestId));
  return { choice };
};
