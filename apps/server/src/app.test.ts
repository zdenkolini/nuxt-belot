import { expect, test } from 'bun:test';
import { baseURL, linkIn, setup, webURL } from '#src/test/setup';

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
  expect(data).toEqual({
    id: expect.any(String),
    email: 'ana@example.com',
    username: null,
    isGuest: false,
    room: null,
  });
});

test('the account is not available without a session', async () => {
  const { api } = await setup();
  const { status } = await api.me.get();
  expect(status).toBe(401);
});

test('a player picks a username', async () => {
  const { api, signIn } = await setup();
  const session = await signIn('ana@example.com');

  const { status } = await api.me.username.put({ username: 'ana' }, session);
  expect(status).toBe(200);
  const { data } = await api.me.get(session);
  expect(data).toEqual({
    id: expect.any(String),
    email: 'ana@example.com',
    username: 'ana',
    isGuest: false,
    room: null,
  });
});

test('a taken username is rejected, whatever its case', async () => {
  const { api, signIn } = await setup();
  const ana = await signIn('ana@example.com');
  const bob = await signIn('bob@example.com');
  await api.me.username.put({ username: 'Ana' }, ana);

  const { status, error } = await api.me.username.put({ username: 'ana' }, bob);
  expect(status).toBe(409);
  expect(error?.value).toEqual({ error: 'username_taken' });
  const { data } = await api.me.get(bob);
  expect(data?.username).toBeNull();
});

test('a second username change within 30 days is rejected', async () => {
  const { api, signIn } = await setup();
  const ana = await signIn('ana@example.com');
  await api.me.username.put({ username: 'ana' }, ana);

  const first = await api.me.username.put({ username: 'ana2' }, ana);
  expect(first.status).toBe(200);
  const second = await api.me.username.put({ username: 'ana3' }, ana);
  expect(second.status).toBe(429);
  expect(second.error?.value).toEqual({ error: 'username_change_too_soon' });
  const { data } = await api.me.get(ana);
  expect(data?.username).toBe('ana2');
});

test('signing out ends the session', async () => {
  const { app, api, signIn } = await setup();
  const ana = await signIn('ana@example.com');

  const res = await app.handle(
    new Request(`${baseURL}/api/auth/sign-out`, {
      method: 'POST',
      headers: { ...ana.headers, origin: webURL },
    }),
  );
  expect(res.status).toBe(200);
  const { status } = await api.me.get(ana);
  expect(status).toBe(401);
});
