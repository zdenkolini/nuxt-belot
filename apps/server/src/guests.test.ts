import { afterEach, expect, setSystemTime, test } from 'bun:test';
import { claims } from '@belot/db';
import { linkIn, setup, webURL, type Session } from './test-setup';

type Ctx = Awaited<ReturnType<typeof setup>>;

afterEach(() => setSystemTime());

// Past the cooldown that leaving a match mid-play starts.
const afterCooldown = () =>
  setSystemTime(new Date(Date.now() + 21 * 60 * 1000));

// The player starts a match against three bots, then leaves the room, which
// abandons it; the match stays in their match history.
const playMatch = async ({ api }: Ctx, session: Session) => {
  const { data } = await api.rooms.post({}, session);
  const room = api.rooms({ id: data!.id });
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
  expect(data!.username).toMatch(/^guest_[a-z0-9]{6}$/);
  expect((await api.rooms.post({}, me)).status).toBe(200);
});

test('a guest cannot rename; they claim their account first', async () => {
  const { api, guest } = await setup();
  const me = await guest();

  const { status, error } = await api.me.username.put({ username: 'ana' }, me);
  expect(status).toBe(403);
  expect(error?.value).toEqual({ error: 'guest_cannot_rename' });
});

test('a guest in a room cannot ask for a claim link', async () => {
  const { api, sent, guest, requestLink } = await setup();
  const me = await guest();
  const { data: room } = await api.rooms.post({}, me);

  const res = await requestLink('ana@example.com', me);
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({
    code: 'GUEST_IN_ROOM',
    roomId: room!.id,
  });
  expect(sent).toHaveLength(0);
});

test('a guest who joins a room after asking cannot claim with that link', async () => {
  const { app, api, sent, guest, requestLink } = await setup();
  const me = await guest();
  await requestLink('ana@example.com', me);
  const { data: room } = await api.rooms.post({}, me);

  const res = await app.handle(new Request(linkIn(sent[0]!), me));
  expect(res.status).toBe(302);
  expect(res.headers.get('location')).toBe(
    `${webURL}/?error=GUEST_IN_ROOM&room=${room!.id}`,
  );
  expect((await api.me.get(me)).data).toMatchObject({
    id: me.id,
    isGuest: true,
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
  const [match] = (await api.me.matches.get(me)).data!;

  await requestLink('ana@example.com', me);
  const claimed = await openLink('ana@example.com', me);

  const { data } = await api.me.get(claimed);
  expect(data).toMatchObject({
    email: 'ana@example.com',
    username: null,
    isGuest: false,
  });
  expect(data!.id).not.toBe(me.id);
  expect((await api.me.matches.get(claimed)).data).toEqual([match!]);
  expect((await api.me.get(me)).status).toBe(401);
  expect(await ctx.db.select().from(claims)).toMatchObject([
    {
      guestId: me.id,
      accountId: data!.id,
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
  const [anaMatch] = (await api.me.matches.get(ana)).data!;

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
  expect((await api.me.matches.get(claimed)).data).toEqual([anaMatch!]);
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
  afterCooldown();
  // Ana and her guest at one table, on opposite teams.
  const { data } = await api.rooms.post({}, ana);
  const room = api.rooms({ id: data!.id });
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
