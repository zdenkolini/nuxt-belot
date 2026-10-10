import { cors } from '@elysiajs/cors';
import { user } from '@belot/db';
import { eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { createAuth, type AuthOptions } from './auth';

export type { Email } from './auth';

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
    );
};

export type App = ReturnType<typeof createApp>;
