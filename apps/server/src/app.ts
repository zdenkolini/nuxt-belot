import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { createAuth, type AuthOptions } from '#src/plugins/auth';
import { errors } from '#src/plugins/errors';
import { accountRoutes } from '#src/modules/account/index';
import { socketRoutes } from '#src/modules/sockets/index';
import { createSockets } from '#src/modules/sockets/service';
import { createRooms } from '#src/rooms';
import { createSession } from '#src/plugins/session';

export type { Email } from '#src/plugins/auth';
export type { ChatIntent, ChatMessage } from '#src/chat';
export type { MatchIntent, MatchView, MoveRejection } from '#src/play';
export type { RoomMessage } from '#src/modules/sockets/service';
export type { PublicRoom, RoomView } from '#src/rooms';

// Async because live matches are rebuilt from the database first.
// `bots` lets a room owner seat bots; for testing, never in production.
export const createApp = async (options: AuthOptions & { bots?: boolean }) => {
  const { db } = options;
  const sockets = createSockets();
  const rooms = await createRooms(db, options.bots ?? false, sockets);
  const auth = createAuth(options, rooms);
  const session = createSession(auth);

  return new Elysia()
    .use(cors({ origin: options.webURL, credentials: true }))
    .use(errors)
    .mount(auth.handler)
    .use(session)
    .use(rooms.routes(session))
    .use(socketRoutes(session, sockets, rooms.socketHandlers))
    .use(accountRoutes(db, session, rooms))
    .get('/health', () => ({ status: 'ok' as const }));
};

export type App = Awaited<ReturnType<typeof createApp>>;
