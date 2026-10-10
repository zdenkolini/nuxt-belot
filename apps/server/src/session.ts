import { Elysia } from 'elysia';
import type { createAuth } from './auth';

// `{ auth: true }` on a route rejects requests without a session and gives
// the handler the signed-in `userId`.
export const createSession = (auth: ReturnType<typeof createAuth>) =>
  new Elysia({ name: 'session' }).macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        if (!session) return status(401);
        return { userId: session.user.id };
      },
    },
  });

export type Session = ReturnType<typeof createSession>;
