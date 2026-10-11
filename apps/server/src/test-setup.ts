import { afterEach } from 'bun:test';
import { treaty } from '@elysiajs/eden';
import { createDb, type Db } from '@belot/db';
import { createApp, type Email, type RoomMessage } from './app';

export const baseURL = 'http://localhost:3000';
export const webURL = 'http://localhost:5173';
export const linkIn = (email: Email) => email.text.match(/https?:\/\/\S+/)![0];

export type Session = { headers: { cookie: string } };

const servers: { server: unknown; stop: () => unknown }[] = [];
afterEach(() => {
  for (const app of servers.splice(0)) if (app.server) app.stop();
});

// Pass the db of an earlier setup to start a new server over the same data.
export const setup = async (db?: Db) => {
  const sent: Email[] = [];
  db ??= await createDb();
  const app = await createApp({
    db,
    sendEmail: async (email) => {
      sent.push(email);
    },
    baseURL,
    secret: 'test-secret-that-is-at-least-32-chars',
    webURL,
    bots: true,
  });
  const api = treaty(app);

  // A player asks for a magic link and follows it, as the browser would.
  const signIn = async (email: string): Promise<Session> => {
    await app.handle(
      new Request(`${baseURL}/api/auth/sign-in/magic-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, callbackURL: `${webURL}/` }),
      }),
    );
    const link = linkIn(sent.findLast((e) => e.to === email)!);
    const res = await app.handle(new Request(link));
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    return { headers: { cookie } };
  };

  // A signed-in player with a username, and their user id.
  const player = async (username: string) => {
    const session = await signIn(`${username}@example.com`);
    await api.me.username.put({ username }, session);
    const { data } = await api.me.get(session);
    return { ...session, id: data!.id };
  };

  // Eden's WebSocket cannot send the session cookie, so tests open the room
  // socket with Bun's WebSocket on a listening server, as a browser would.
  let url: URL | undefined;
  const connect = async (roomId: string, session: Session) => {
    if (!url) {
      app.listen(0);
      servers.push(app);
      url = app.server!.url;
    }
    const ws = new WebSocket(`ws://${url.host}/rooms/${roomId}/ws`, {
      headers: session.headers,
    } as unknown as string[]);
    const messages: RoomMessage[] = [];
    const waiters: (() => void)[] = [];
    let closed = false;
    ws.addEventListener('message', (e) => {
      messages.push(JSON.parse(String(e.data)));
      waiters.splice(0).forEach((w) => w());
    });
    ws.addEventListener('close', () => {
      closed = true;
      waiters.splice(0).forEach((w) => w());
    });
    let read = 0;
    // The next message not yet read; undefined once the socket closed.
    const next = async (): Promise<RoomMessage | undefined> => {
      while (read >= messages.length && !closed) {
        await new Promise<void>((resolve) => waiters.push(resolve));
      }
      return messages[read++];
    };
    return { ws, next, isClosed: () => closed };
  };

  return { app, db, api, sent, signIn, player, connect };
};

export type Socket = Awaited<
  ReturnType<Awaited<ReturnType<typeof setup>>['connect']>
>;

// The next message of one type, skipping the others.
export const nextOf = async <Type extends RoomMessage['type']>(
  socket: Socket,
  type: Type,
) => {
  for (;;) {
    const message = await socket.next();
    if (!message) throw new Error(`socket closed before a ${type} message`);
    if (message.type === type)
      return message as Extract<RoomMessage, { type: Type }>;
  }
};

export const send = (socket: Socket, move: unknown) =>
  socket.ws.send(JSON.stringify({ type: 'match.move', move }));

// Four players seated in seat order, each with an open room socket.
export const table = async () => {
  const ctx = await setup();
  const names = ['ana', 'bob', 'cid', 'dan'];
  const players = [];
  for (const name of names) players.push(await ctx.player(name));
  const { data } = await ctx.api.rooms.post({}, players[0]!);
  const room = ctx.api.rooms({ id: data!.id });
  for (const [seat, p] of players.entries()) {
    await room.join.post({}, p);
    await room.seat.put({ seat }, p);
  }
  const sockets = [];
  for (const p of players) {
    const socket = await ctx.connect(data!.id, p);
    await nextOf(socket, 'room');
    sockets.push(socket);
  }
  return { ...ctx, room, roomId: data!.id, players, sockets };
};
