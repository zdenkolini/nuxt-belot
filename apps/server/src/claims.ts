import { claims, matches, user, type Db } from '@belot/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import type { Session } from './session';

const sat = (userId: string) =>
  sql`${matches.seats} @> ${JSON.stringify([userId])}::jsonb`;

export const countMatches = async (db: Db, userId: string) =>
  (await db.select({ id: matches.id }).from(matches).where(sat(userId))).length;

// Moves a guest's matches to an account. A match where both sat stays with
// the guest, so no player ends up on both teams.
export const moveMatches = async (
  db: Db,
  guestId: string,
  accountId: string,
) => {
  const list = await db.select().from(matches).where(sat(guestId));
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
      .where(sql`${matches.id} = ${match.id}`);
  }
  return { skipped };
};

const pendingClaim = async (db: Db, accountId: string) => {
  const [claim] = await db
    .select()
    .from(claims)
    .where(and(eq(claims.accountId, accountId), isNull(claims.choice)));
  return claim;
};

// A claim into an account that has its own history waits here until the
// player chooses which history to keep.
export const claimRoutes = (db: Db, session: Session) =>
  new Elysia()
    .use(session)
    .get(
      '/me/claim',
      async ({ userId }) => {
        const claim = await pendingClaim(db, userId);
        if (!claim) return { claim: null };
        return {
          claim: {
            guestMatches: claim.guestMatches,
            accountMatches: await countMatches(db, userId),
          },
        };
      },
      { auth: true },
    )
    .post(
      '/me/claim',
      async ({ userId, body: { choice }, status }) => {
        const claim = await pendingClaim(db, userId);
        if (!claim) return status(404, { error: 'no_pending_claim' as const });
        const { skipped } =
          choice === 'merged'
            ? await moveMatches(db, claim.guestId, userId)
            : { skipped: 0 };
        await db
          .update(claims)
          .set({ choice, skipped, decidedAt: new Date() })
          .where(eq(claims.id, claim.id));
        await db.delete(user).where(eq(user.id, claim.guestId));
        return { choice };
      },
      {
        auth: true,
        body: t.Object({
          choice: t.Union([t.Literal('kept_account'), t.Literal('merged')]),
        }),
      },
    );
