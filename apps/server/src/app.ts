import { cors } from '@elysiajs/cors';
import { user } from '@belot/db';
import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { createAuth, type AuthOptions } from './auth';
import { roomRoutes } from './rooms';
import { createSession } from './session';

export type { Email } from './auth';
export type { ChatIntent, ChatMessage } from './chat';
export type { MatchIntent, MatchView, MoveRejection } from './play';
export type { PublicRoom, RoomMessage, RoomView, TargetScore } from './rooms';

const usernameChangeInterval = 30 * 24 * 60 * 60 * 1000;

// Drizzle wraps the driver error; Postgres code 23505 is a unique violation.
const isUniqueViolation = (e: unknown) =>
  e instanceof Error &&
  (e.cause as { code?: string } | undefined)?.code === '23505';

// Async because live matches are rebuilt from the database first.
export const createApp = async (options: AuthOptions) => {
  const { db } = options;
  const auth = createAuth(options);
  const session = createSession(auth);

  return new Elysia()
    .use(cors({ origin: options.webURL, credentials: true }))
    .mount(auth.handler)
    .use(session)
    .use(await roomRoutes(db, session))
    .get('/health', () => ({ status: 'ok' as const }))
    .get(
      '/me',
      async ({ userId }) => {
        const [me] = await db
          .select({ id: user.id, email: user.email, username: user.username })
          .from(user)
          .where(eq(user.id, userId));
        return me!;
      },
      { auth: true },
    )
    .put(
      '/me/username',
      async ({ userId, body: { username }, status }) => {
        const [me] = await db
          .select({
            username: user.username,
            changedAt: user.usernameChangedAt,
          })
          .from(user)
          .where(eq(user.id, userId));
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
    );
};

export type App = Awaited<ReturnType<typeof createApp>>;
