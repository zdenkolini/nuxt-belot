import { cors } from '@elysiajs/cors';
import { matches, user } from '@belot/db';
import { desc, eq, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { createAuth, type AuthOptions } from './auth';
import { claimRoutes } from './claims';
import { createRooms } from './rooms';
import { createSession } from './session';

export type { Email } from './auth';
export type { ChatIntent, ChatMessage } from './chat';
export type { MatchIntent, MatchView, MoveRejection } from './play';
export type { PublicRoom, RoomMessage, RoomView } from './rooms';

const usernameChangeInterval = 30 * 24 * 60 * 60 * 1000;

// Drizzle wraps the driver error; Postgres code 23505 is a unique violation.
const isUniqueViolation = (e: unknown) =>
  e instanceof Error &&
  (e.cause as { code?: string } | undefined)?.code === '23505';

// Async because live matches are rebuilt from the database first.
// `bots` lets a room owner seat bots; for testing, never in production.
export const createApp = async (options: AuthOptions & { bots?: boolean }) => {
  const { db } = options;
  const rooms = await createRooms(db, options.bots ?? false);
  const auth = createAuth(options, rooms);
  const session = createSession(auth);

  return (
    new Elysia()
      .use(cors({ origin: options.webURL, credentials: true }))
      .mount(auth.handler)
      .use(session)
      .use(rooms.routes(session))
      .use(claimRoutes(db, session))
      .get('/health', () => ({ status: 'ok' as const }))
      .get(
        '/me',
        async ({ userId }) => {
          const [me] = await db
            .select({
              id: user.id,
              email: user.email,
              username: user.username,
              isGuest: user.isAnonymous,
            })
            .from(user)
            .where(eq(user.id, userId));
          return {
            ...me!,
            isGuest: me!.isGuest ?? false,
            room: await rooms.seated(userId),
          };
        },
        { auth: true },
      )
      // Match history: every match the player sat in, newest first.
      .get(
        '/me/matches',
        ({ userId }) =>
          db
            .select({ id: matches.id })
            .from(matches)
            .where(sql`${matches.seats} @> ${JSON.stringify([userId])}::jsonb`)
            .orderBy(desc(matches.createdAt)),
        { auth: true },
      )
      .put(
        '/me/username',
        async ({ userId, body: { username }, status }) => {
          const [me] = await db
            .select({
              username: user.username,
              changedAt: user.usernameChangedAt,
              isGuest: user.isAnonymous,
            })
            .from(user)
            .where(eq(user.id, userId));
          if (me!.isGuest) {
            return status(403, { error: 'guest_cannot_rename' as const });
          }
          // The first pick is free; after that one change per 30 days.
          const isChange = me!.username !== null;
          if (
            isChange &&
            me!.changedAt &&
            Date.now() - me!.changedAt.getTime() < usernameChangeInterval
          ) {
            return status(429, { error: 'username_change_too_soon' as const });
          }
          try {
            await db
              .update(user)
              .set({
                username,
                ...(isChange && { usernameChangedAt: new Date() }),
              })
              .where(eq(user.id, userId));
          } catch (e) {
            if (isUniqueViolation(e)) {
              return status(409, { error: 'username_taken' as const });
            }
            throw e;
          }
          return { username };
        },
        {
          auth: true,
          body: t.Object({
            username: t.String({
              minLength: 3,
              maxLength: 20,
              pattern: '^[A-Za-z0-9_]+$',
            }),
          }),
        },
      )
  );
};

export type App = Awaited<ReturnType<typeof createApp>>;
