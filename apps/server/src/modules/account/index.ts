import type { Db } from '@belot/db';
import { Elysia } from 'elysia';
import {
  claimBody,
  usernameBody,
  usernameResponse,
} from '#src/modules/account/model';
import {
  claimStatus,
  decideClaim,
  matchHistory,
  me,
  setUsername,
} from '#src/modules/account/service';
import type { Session } from '#src/plugins/session';
import type { createRooms } from '#src/rooms';

type Rooms = Pick<Awaited<ReturnType<typeof createRooms>>, 'seated'>;

export const accountRoutes = (db: Db, session: Session, rooms: Rooms) =>
  new Elysia({ prefix: '/me' })
    .use(session)
    .get(
      '/',
      async ({ userId }) => ({
        ...(await me(db, userId)),
        room: await rooms.seated(userId),
      }),
      { auth: true },
    )
    .get('/matches', ({ userId }) => matchHistory(db, userId), { auth: true })
    .put(
      '/username',
      ({ userId, body: { username } }) => setUsername(db, userId, username),
      { auth: true, body: usernameBody, response: usernameResponse },
    )
    .get('/claim', ({ userId }) => claimStatus(db, userId), { auth: true })
    .post(
      '/claim',
      ({ userId, body: { choice } }) => decideClaim(db, userId, choice),
      { auth: true, body: claimBody },
    );
