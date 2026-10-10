import { cors } from '@elysiajs/cors';
import { user } from '@belot/db';
import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { createAuth, type AuthOptions } from './auth';

export type { Email } from './auth';

const usernameChangeInterval = 30 * 24 * 60 * 60 * 1000;

// Drizzle wraps the driver error; Postgres code 23505 is a unique violation.
const isUniqueViolation = (e: unknown) =>
  e instanceof Error && (e.cause as { code?: string } | undefined)?.code === '23505';

export const createApp = (options: AuthOptions) => {
  const { db } = options;
  const auth = createAuth(options);

  return new Elysia()
    .use(cors({ origin: options.webURL, credentials: true }))
    .mount(auth.handler)
    .macro({
      auth: {
        async resolve({ status, request: { headers } }) {
          const session = await auth.api.getSession({ headers });
          if (!session) return status(401);
          return { userId: session.user.id };
        },
      },
    })
    .get('/health', () => ({ status: 'ok' as const }))
    .get(
      '/me',
      async ({ userId }) => {
        const [me] = await db
          .select({ email: user.email, username: user.username })
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
          .select({ username: user.username, changedAt: user.usernameChangedAt })
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
            .set({ username, ...(isChange && { usernameChangedAt: new Date() }) })
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

export type App = ReturnType<typeof createApp>;
