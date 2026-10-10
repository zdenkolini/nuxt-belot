import { expect, test } from 'bun:test';
import { treaty } from '@elysiajs/eden';
import { createDb } from '@belot/db';
import { createApp, type Email } from './app';

const baseURL = 'http://localhost:3000';
const linkIn = (email: Email) => email.text.match(/https?:\/\/\S+/)![0];

const setup = async () => {
  const sent: Email[] = [];
  const app = createApp({
    db: await createDb(),
    sendEmail: async (email) => {
      sent.push(email);
    },
    baseURL,
    secret: 'test-secret-that-is-at-least-32-chars',
    webURL: 'http://localhost:5173',
  });
  const api = treaty(app);

  // A player asks for a magic link and follows it, as the browser would.
  const signIn = async (email: string) => {
    await app.handle(
      new Request(`${baseURL}/api/auth/sign-in/magic-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, callbackURL: 'http://localhost:5173/' }),
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

  return { api, sent, signIn };
};

test('health endpoint reports ok', async () => {
  const { api } = await setup();
  const { data, status } = await api.health.get();
  expect(status).toBe(200);
  expect(data).toEqual({ status: 'ok' });
});

test('a magic link signs the player in without a username', async () => {
  const { api, sent, signIn } = await setup();
  const session = await signIn('ana@example.com');

  expect(sent).toHaveLength(1);
  expect(linkIn(sent[0]!)).toStartWith(`${baseURL}/api/auth/magic-link/verify`);
  const { data, status } = await api.me.get(session);
  expect(status).toBe(200);
  expect(data).toEqual({ email: 'ana@example.com', username: null });
});

test('the account is not available without a session', async () => {
  const { api } = await setup();
  const { status } = await api.me.get();
  expect(status).toBe(401);
});
