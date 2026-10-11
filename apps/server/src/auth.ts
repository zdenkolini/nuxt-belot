import { betterAuth } from 'better-auth';
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins/anonymous';
import { magicLink } from 'better-auth/plugins/magic-link';
import * as schema from '@belot/db';
import { claims, rooms } from '@belot/db';
import { sql } from 'drizzle-orm';
import type { Db } from '@belot/db';
import { countMatches, moveMatches } from './claims';

export type Email = { to: string; subject: string; text: string };

// A guest plays under an auto-generated username until they claim.
const guestUsername = () =>
  `guest_${crypto.getRandomValues(new Uint8Array(6)).reduce((name, n) => name + (n % 36).toString(36), '')}`;

// The room the user is a member of, if any.
const roomOf = async (db: Db, userId: string) => {
  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(sql`${rooms.members} @> ${JSON.stringify([userId])}::jsonb`)
    .limit(1);
  return room?.id;
};

export type AuthOptions = {
  db: Db;
  sendEmail: (email: Email) => Promise<void>;
  baseURL: string;
  secret: string;
  webURL: string;
};

export const createAuth = ({
  db,
  sendEmail,
  baseURL,
  secret,
  webURL,
}: AuthOptions) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    baseURL,
    secret,
    trustedOrigins: [webURL],
    telemetry: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 365 },
    // Set through PUT /me/username only.
    user: {
      additionalFields: {
        username: { type: 'string', required: false, input: false },
      },
    },
    hooks: {
      // A guest claims only with nothing pending: no room, seat, or match.
      // Checked when the link is sent and again when it is opened.
      before: createAuthMiddleware(async (ctx) => {
        const sending = ctx.path === '/sign-in/magic-link';
        if (!sending && ctx.path !== '/magic-link/verify') return;
        const session = await getSessionFromCtx(ctx);
        if (!session?.user.isAnonymous) return;
        const roomId = await roomOf(db, session.user.id);
        if (!roomId) return;
        if (!sending) {
          throw ctx.redirect(`${webURL}/?error=GUEST_IN_ROOM&room=${roomId}`);
        }
        throw new APIError('CONFLICT', {
          code: 'GUEST_IN_ROOM',
          message: 'Leave your room before you claim your account',
          roomId,
        });
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) =>
            user.isAnonymous
              ? { data: { ...user, username: guestUsername() } }
              : undefined,
        },
      },
    },
    plugins: [
      anonymous({
        // We delete the guest ourselves, once their matches have a home.
        disableDeleteAnonymousUser: true,
        onLinkAccount: async ({ anonymousUser, newUser, ctx }) => {
          const guestId = anonymousUser.user.id;
          const accountId = newUser.user.id;
          const guestMatches = await countMatches(db, guestId);
          // An account with a username may have its own history: the player
          // chooses what to keep, and the guest waits until then.
          if (newUser.user.username) {
            await db
              .insert(claims)
              .values({ guestId, accountId, existing: true, guestMatches });
            return;
          }
          const { skipped } = await moveMatches(db, guestId, accountId);
          await db.insert(claims).values({
            guestId,
            accountId,
            existing: false,
            choice: 'new',
            guestMatches,
            skipped,
            decidedAt: new Date(),
          });
          await ctx.context.internalAdapter.deleteUser(guestId);
        },
      }),
      magicLink({
        sendMagicLink: ({ email, url }) =>
          sendEmail({
            to: email,
            subject: 'Sign in to Belot',
            text: `Open this link to sign in: ${url}`,
          }),
      }),
    ],
  });
