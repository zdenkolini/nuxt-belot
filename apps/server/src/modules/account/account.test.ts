import assert from 'node:assert';
import { expect, test } from 'bun:test';
import { claims } from '@belot/db';
import { checkRename } from '#src/modules/account/service';
import { Forbidden, TooManyRequests } from '#src/plugins/errors';
import { baseURL, linkIn, setup, webURL, type Session } from '#src/test/setup';

const now = new Date('2026-10-29T12:00:00Z');
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

test('the first username pick is free', () => {
  const me = { username: null, changedAt: null, isGuest: false };
  expect(checkRename(me, now)).toEqual({ isChange: false });
});

test('a change is allowed once 30 days have passed since the last one', () => {
  const me = { username: 'ana', changedAt: daysAgo(30), isGuest: false };
  expect(checkRename(me, now)).toEqual({ isChange: true });
});

test('a change within 30 days of the last one is too soon', () => {
  const me = { username: 'ana', changedAt: daysAgo(29), isGuest: false };
  expect(() => checkRename(me, now)).toThrow(
    new TooManyRequests('username_change_too_soon'),
  );
});

test('a first change after the free pick is allowed at once', () => {
  const me = { username: 'ana', changedAt: null, isGuest: false };
  expect(checkRename(me, now)).toEqual({ isChange: true });
});

test('a guest cannot rename', () => {
  const me = { username: 'guest_abc123', changedAt: null, isGuest: true };
  expect(() => checkRename(me, now)).toThrow(
    new Forbidden('guest_cannot_rename'),
  );
});

test('a magic link signs the player in without a username', async () => {
  const { api, sent, signIn } = await setup();
  const session = await signIn('ana@example.com');

  const [email] = sent;
  expect(sent).toHaveLength(1);
  assert(email);
  expect(linkIn(email)).toStartWith(`${baseURL}/api/auth/magic-link/verify`);
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

type Ctx = Awaited<ReturnType<typeof setup>>;

// The player starts a match against three bots, then leaves the room, which
// abandons it; the match stays in their match history.
const playMatch = async ({ api }: Ctx, session: Session) => {
  const { data } = await api.rooms.post({}, session);
  assert(data);
  const room = api.rooms({ id: data.id });
  await room.seat.put({ seat: 0 }, session);
  for (const seat of [1, 2, 3]) await room.bots.post({ seat }, session);
  await room.start.post({}, session);
  await room.leave.post({}, session);
};

test('a guest signs in with one click, gets a guest username, and can open a room', async () => {
  const { api, guest } = await setup();
  const me = await guest();

  const { data } = await api.me.get(me);
  expect(data).toMatchObject({ isGuest: true });
  assert(data);
  expect(data.username).toMatch(/^guest_[a-z0-9]{6}$/);
  expect((await api.rooms.post({}, me)).status).toBe(200);
});

test('a guest cannot rename; they claim their account first', async () => {
  const { api, guest } = await setup();
  const me = await guest();

  const { status, error } = await api.me.username.put({ username: 'ana' }, me);
  expect(status).toBe(403);
  expect(error?.value).toEqual({ error: 'guest_cannot_rename' });
});

test('asking for a claim link takes the guest out of their room', async () => {
  const { api, sent, guest, player, connect, requestLink } = await setup();
  const me = await guest();
  const bob = await player('bob');
  const { data } = await api.rooms.post({}, me);
  assert(data);
  const room = api.rooms({ id: data.id });
  await room.seat.put({ seat: 0 }, me);
  await room.join.post({}, bob);
  const bobSocket = await connect(data.id, bob);
  await bobSocket.next();

  expect((await requestLink('ana@example.com', me)).status).toBe(200);
  expect(sent.at(-1)?.to).toBe('ana@example.com');
  expect(await bobSocket.next()).toMatchObject({
    room: {
      ownerId: bob.id,
      members: [{ id: bob.id, username: 'bob' }],
      seats: [null, null, null, null],
    },
  });
});

test('a guest who sat down again after asking claims, and the seat is freed', async () => {
  const { api, guest, player, requestLink, openLink } = await setup();
  const me = await guest();
  const bob = await player('bob');
  await requestLink('ana@example.com', me);
  const { data } = await api.rooms.post({}, bob);
  assert(data);
  const room = api.rooms({ id: data.id });
  await room.join.post({}, me);
  await room.seat.put({ seat: 0 }, me);

  const claimed = await openLink('ana@example.com', me);
  expect((await api.me.get(claimed)).data).toMatchObject({
    email: 'ana@example.com',
    room: null,
  });
  const { data: after } = await room.join.post({}, bob);
  expect(after).toMatchObject({
    members: [{ id: bob.id, username: 'bob' }],
    seats: [null, null, null, null],
  });
});

test('a guest in a running match cannot claim with the link and goes back to their room', async () => {
  const { app, api, sent, guest, requestLink } = await setup();
  const me = await guest();
  await requestLink('ana@example.com', me);
  const { data } = await api.rooms.post({}, me);
  assert(data);
  const room = api.rooms({ id: data.id });
  await room.seat.put({ seat: 0 }, me);
  for (const seat of [1, 2, 3]) await room.bots.post({ seat }, me);
  await room.start.post({}, me);

  const [email] = sent;
  assert(email);
  const res = await app.handle(new Request(linkIn(email), me));
  expect(res.status).toBe(302);
  expect(res.headers.get('location')).toBe(
    `${webURL}/rooms/${data.id}?claim=match_running`,
  );
  expect((await api.me.get(me)).data).toMatchObject({
    id: me.id,
    isGuest: true,
    room: { id: data.id, matchRunning: true },
  });
});

test('a player sees the matches they played', async () => {
  const ctx = await setup();
  const ana = await ctx.player('ana');
  const bob = await ctx.player('bob');
  await playMatch(ctx, ana);

  expect((await ctx.api.me.matches.get(ana)).data).toEqual([
    { id: expect.any(String) },
  ]);
  expect((await ctx.api.me.matches.get(bob)).data).toEqual([]);
});

test('a guest claims with a new email: same matches, new account, username to pick', async () => {
  const ctx = await setup();
  const { api, guest, requestLink, openLink } = ctx;
  const me = await guest();
  await playMatch(ctx, me);
  const { data: guestMatches } = await api.me.matches.get(me);
  assert(guestMatches);
  const [match] = guestMatches;
  assert(match);

  await requestLink('ana@example.com', me);
  const claimed = await openLink('ana@example.com', me);

  const { data } = await api.me.get(claimed);
  expect(data).toMatchObject({
    email: 'ana@example.com',
    username: null,
    isGuest: false,
  });
  assert(data);
  expect(data.id).not.toBe(me.id);
  expect((await api.me.matches.get(claimed)).data).toEqual([match]);
  expect((await api.me.get(me)).status).toBe(401);
  expect(await ctx.db.select().from(claims)).toMatchObject([
    {
      guestId: me.id,
      accountId: data.id,
      existing: false,
      choice: 'new',
      guestMatches: 1,
      skipped: 0,
    },
  ]);
});

// Ana has an account and a match; in another browser she plays a match as a
// guest, then claims that guest with her email.
const claimIntoAna = async () => {
  const ctx = await setup();
  const ana = await ctx.player('ana');
  await playMatch(ctx, ana);
  const me = await ctx.guest();
  await playMatch(ctx, me);
  await ctx.requestLink('ana@example.com', me);
  const claimed = await ctx.openLink('ana@example.com', me);
  return { ...ctx, ana, me, claimed };
};

test('a guest claims into an existing account and keeps only its matches', async () => {
  const { api, db, ana, me, claimed } = await claimIntoAna();
  const { data: anaMatches } = await api.me.matches.get(ana);
  assert(anaMatches);
  const [anaMatch] = anaMatches;
  assert(anaMatch);

  expect((await api.me.get(claimed)).data).toMatchObject({
    id: ana.id,
    username: 'ana',
  });
  expect((await api.me.claim.get(claimed)).data).toEqual({
    claim: { guestMatches: 1, accountMatches: 1 },
  });

  expect(
    (await api.me.claim.post({ choice: 'kept_account' }, claimed)).status,
  ).toBe(200);
  expect((await api.me.matches.get(claimed)).data).toEqual([anaMatch]);
  expect((await api.me.claim.get(claimed)).data).toEqual({ claim: null });
  expect((await api.me.get(me)).status).toBe(401);
  expect(await db.select().from(claims)).toMatchObject([
    {
      guestId: me.id,
      accountId: ana.id,
      existing: true,
      choice: 'kept_account',
      guestMatches: 1,
    },
  ]);
});

test('a merge adds the guest matches, but not a match where both sat', async () => {
  const ctx = await setup();
  const { api, db } = ctx;
  const ana = await ctx.player('ana');
  const me = await ctx.guest();
  await playMatch(ctx, ana);
  await playMatch(ctx, me);
  // Ana and her guest at one table, on opposite teams.
  const { data } = await api.rooms.post({}, ana);
  assert(data);
  const room = api.rooms({ id: data.id });
  await room.join.post({}, me);
  await room.seat.put({ seat: 0 }, ana);
  await room.seat.put({ seat: 1 }, me);
  for (const seat of [2, 3]) await room.bots.post({ seat }, ana);
  await room.start.post({}, ana);
  await room.leave.post({}, me);
  await room.leave.post({}, ana);

  await ctx.requestLink('ana@example.com', me);
  const claimed = await ctx.openLink('ana@example.com', me);
  expect((await api.me.claim.post({ choice: 'merged' }, claimed)).status).toBe(
    200,
  );

  expect((await api.me.matches.get(claimed)).data).toHaveLength(3);
  expect(await db.select().from(claims)).toMatchObject([
    { choice: 'merged', guestMatches: 2, skipped: 1 },
  ]);
});
