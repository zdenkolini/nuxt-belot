import { Elysia } from 'elysia';
import type { createAuth } from '#src/auth';

// `{ auth: true }` on a route rejects requests without a session and gives
// the handler the signed-in `userId`. `{ player: true }` also rejects users
// who have not picked a username yet.
export const createSession = (auth: ReturnType<typeof createAuth>) =>
  new Elysia({ name: 'session' }).macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        if (!session) return status(401);
        return { userId: session.user.id };
      },
    },
    player: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        if (!session) return status(401);
        if (!session.user.username) {
          return status(403, { error: 'username_required' as const });
        }
        return { userId: session.user.id };
      },
    },
  });

export type Session = ReturnType<typeof createSession>;

// A signed-in user in one room.
export type Member = { roomId: string; userId: string };
