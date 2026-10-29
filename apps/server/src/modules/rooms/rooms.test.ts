import assert from 'node:assert';
import { expect, test } from 'bun:test';
import { targetScores } from '@belot/engine';
import {
  addMember,
  assertMember,
  assertOwner,
  leave,
  nextOwner,
  removeMember,
  seatedPlayers,
  takeSeat,
  type Room,
} from '#src/modules/rooms/service';
import { Conflict, Forbidden, NotFound } from '#src/plugins/errors';
import { setup, table } from '#src/test/setup';

const roomOf = (room: Partial<Room>): Room => ({
  id: 'r1',
  ownerId: 'ana',
  isPublic: false,
  targetScore: 1001,
  members: ['ana'],
  seats: [null, null, null, null],
  removed: [],
  createdAt: new Date(),
  ...room,
});

test('the next owner is the next seated player counter-clockwise', () => {
  const room = roomOf({
    members: ['ana', 'bob', 'cid'],
    seats: ['ana', null, 'cid', 'bob'],
  });
  expect(nextOwner(room)).toBe('cid');
});

test('the next owner skips bots, else is the longest-staying member', () => {
  const room = roomOf({
    members: ['ana', 'bot-1', 'bob', 'cid'],
    seats: ['ana', 'bot-1', null, null],
  });
  expect(nextOwner(room)).toBe('bob');
});

test('a member who leaves gives up their seat and the room owner', () => {
  const room = roomOf({
    members: ['ana', 'bob'],
    seats: ['ana', 'bob', null, null],
  });
  leave(room, 'ana');
  expect(room).toMatchObject({
    ownerId: 'bob',
    members: ['bob'],
    seats: [null, 'bob', null, null],
  });
});

test('a room with only bots left has no members', () => {
  const room = roomOf({
    members: ['ana', 'bot-1'],
    seats: ['ana', 'bot-1', null, null],
  });
  leave(room, 'ana');
  expect(room.members).toEqual([]);
});

test('a removed player cannot join again', () => {
  const room = roomOf({ removed: ['bob'] });
  expect(() => addMember(room, 'bob')).toThrow(
    new Forbidden('removed_from_room'),
  );
});

test('joining twice keeps one membership', () => {
  const room = roomOf({});
  addMember(room, 'bob');
  addMember(room, 'bob');
  expect(room.members).toEqual(['ana', 'bob']);
});

test('only members and only the room owner pass their checks', () => {
  const room = roomOf({});
  expect(() => assertMember(room, 'bob')).toThrow(
    new Forbidden('not_a_member'),
  );
  expect(() => assertOwner(room, 'bob')).toThrow(
    new Forbidden('not_the_owner'),
  );
  assertMember(room, 'ana');
  assertOwner(room, 'ana');
});

test('taking a seat frees the old one; a taken seat is rejected', () => {
  const room = roomOf({
    members: ['ana', 'bob'],
    seats: ['ana', 'bob', null, null],
  });
  takeSeat(room, 'ana', 2);
  expect(room.seats).toEqual([null, 'bob', 'ana', null]);
  expect(() => takeSeat(room, 'ana', 1)).toThrow(new Conflict('seat_taken'));
});

test('the room owner removes a member, who is marked removed', () => {
  const room = roomOf({
    members: ['ana', 'bob'],
    seats: [null, 'bob', null, null],
  });
  removeMember(room, 'bob');
  expect(room).toMatchObject({
    members: ['ana'],
    seats: [null, null, null, null],
    removed: ['bob'],
  });
  expect(() => removeMember(room, 'bob')).toThrow(
    new NotFound('member_not_found'),
  );
  expect(() => removeMember(room, 'ana')).toThrow(
    new NotFound('member_not_found'),
  );
});

test('a match starts only with four seated players', () => {
  expect(() => seatedPlayers(roomOf({}))).toThrow(
    new Conflict('seats_not_full'),
  );
  expect(seatedPlayers(roomOf({ seats: ['a', 'b', 'c', 'd'] }))).toEqual([
    'a',
    'b',
    'c',
    'd',
  ]);
});

// Ana creates a room; the other players open its invite link.
const roomWith = async (...others: string[]) => {
  const ctx = await setup();
  const ana = await ctx.player('ana');
  const { data: room } = await ctx.api.rooms.post({}, ana);
  assert(room);
  const players: [typeof ana, ...(typeof ana)[]] = [ana];
  for (const name of others) {
    const p = await ctx.player(name);
    await ctx.api.rooms({ id: room.id }).join.post({}, p);
    players.push(p);
  }
  return { ...ctx, roomId: room.id, players };
};

test('the creator of a room is its room owner and gets the room over the socket', async () => {
  const { api, player, connect } = await setup();
  const ana = await player('ana');

  const { data: room, status } = await api.rooms.post({}, ana);
  expect(status).toBe(200);
  expect(room).toMatchObject({
    ownerId: ana.id,
    isPublic: false,
    targetScore: 1001,
    members: [{ id: ana.id, username: 'ana' }],
    seats: [null, null, null, null],
  });

  assert(room);
  const socket = await connect(room.id, ana);
  expect(await socket.next()).toEqual({ type: 'room', room });
});

test('rooms need a session', async () => {
  const { api } = await setup();
  expect((await api.rooms.post({})).status).toBe(401);
  expect((await api.rooms.get()).status).toBe(401);
});

test('opening the invite link puts a player in the room, live for everyone', async () => {
  const { api, player, connect } = await setup();
  const ana = await player('ana');
  const bob = await player('bob');
  const { data: room } = await api.rooms.post({}, ana);
  assert(room);
  const anaSocket = await connect(room.id, ana);
  await anaSocket.next();

  const { data, status } = await api.rooms({ id: room.id }).join.post({}, bob);
  expect(status).toBe(200);
  const members = [
    { id: ana.id, username: 'ana' },
    { id: bob.id, username: 'bob' },
  ];
  expect(data?.members).toEqual(members);
  expect(await anaSocket.next()).toMatchObject({
    type: 'room',
    room: { members },
  });
});

test('a player without a username cannot create or join a room', async () => {
  const { api, roomId, signIn } = await roomWith();
  const newcomer = await signIn('new@example.com');

  const created = await api.rooms.post({}, newcomer);
  expect(created.status).toBe(403);
  expect(created.error?.value).toEqual({ error: 'username_required' });
  const joined = await api.rooms({ id: roomId }).join.post({}, newcomer);
  expect(joined.status).toBe(403);
  expect(joined.error?.value).toEqual({ error: 'username_required' });
});

test('only members can open the room socket', async () => {
  const { roomId, player, connect } = await roomWith();
  const eve = await player('eve');

  const socket = await connect(roomId, eve);
  expect(await socket.next()).toBeUndefined();
  expect(socket.isClosed()).toBe(true);
});

test('a private room is not listed; a public room is listed with its seated players', async () => {
  const { api, roomId, players } = await roomWith('bob');
  const [ana, bob] = players;
  assert(bob);
  expect((await api.rooms.get(bob)).data).toEqual([]);

  await api.rooms({ id: roomId }).patch({ isPublic: true }, ana);
  await api.rooms({ id: roomId }).seat.put({ seat: 2 }, ana);
  await api.rooms({ id: roomId }).seat.put({ seat: 0 }, bob);
  const { data } = await api.rooms.get(bob);
  expect(data).toEqual([
    { id: roomId, owner: 'ana', targetScore: 1001, players: ['bob', 'ana'] },
  ]);
});

test('players pick, move to, and leave seats, and everyone sees it live', async () => {
  const { api, roomId, players, connect } = await roomWith('bob');
  const [ana, bob] = players;
  assert(bob);
  const room = api.rooms({ id: roomId });
  const bobSocket = await connect(roomId, bob);
  await bobSocket.next();

  await room.seat.put({ seat: 0 }, ana);
  expect(await bobSocket.next()).toMatchObject({
    room: { seats: [ana.id, null, null, null] },
  });

  const taken = await room.seat.put({ seat: 0 }, bob);
  expect(taken.status).toBe(409);
  expect(taken.error?.value).toEqual({ error: 'seat_taken' });

  await room.seat.put({ seat: 3 }, ana);
  expect(await bobSocket.next()).toMatchObject({
    room: { seats: [null, null, null, ana.id] },
  });

  await room.seat.delete({}, ana);
  expect(await bobSocket.next()).toMatchObject({
    room: { seats: [null, null, null, null] },
  });
});

test('only members can take a seat', async () => {
  const { api, roomId, player } = await roomWith();
  const eve = await player('eve');
  const { status } = await api.rooms({ id: roomId }).seat.put({ seat: 0 }, eve);
  expect(status).toBe(403);
});

test('the room owner sets the target score; other players cannot', async () => {
  const { api, roomId, players, connect } = await roomWith('bob');
  const [ana, bob] = players;
  assert(bob);
  const room = api.rooms({ id: roomId });
  const bobSocket = await connect(roomId, bob);
  await bobSocket.next();

  const denied = await room.patch({ targetScore: 501 }, bob);
  expect(denied.status).toBe(403);
  expect(denied.error?.value).toEqual({ error: 'not_the_owner' });

  expect((await room.patch({ targetScore: 701 }, ana)).status).toBe(200);
  expect(await bobSocket.next()).toMatchObject({ room: { targetScore: 701 } });
});

test('the target score is 501, 701, or 1001', async () => {
  const { api, roomId, players } = await roomWith();
  for (const targetScore of targetScores) {
    const accepted = await api
      .rooms({ id: roomId })
      .patch({ targetScore }, players[0]);
    expect(accepted.status).toBe(200);
  }
  const { status } = await api
    .rooms({ id: roomId })
    // @ts-expect-error a client may send any number
    .patch({ targetScore: 600 }, players[0]);
  expect(status).toBe(422);
});

test('the room owner removes a player, who cannot come back', async () => {
  const { api, roomId, players, connect } = await roomWith('bob', 'cara');
  const [ana, bob, cara] = players;
  assert(bob && cara);
  const room = api.rooms({ id: roomId });
  await room.seat.put({ seat: 1 }, bob);
  const bobSocket = await connect(roomId, bob);
  const caraSocket = await connect(roomId, cara);
  await bobSocket.next();
  await caraSocket.next();

  const denied = await room.members({ userId: bob.id }).delete({}, cara);
  expect(denied.status).toBe(403);

  expect((await room.members({ userId: bob.id }).delete({}, ana)).status).toBe(
    200,
  );
  expect(await bobSocket.next()).toEqual({ type: 'removed' });
  expect(await bobSocket.next()).toBeUndefined();
  expect(await caraSocket.next()).toMatchObject({
    room: {
      members: [
        { id: ana.id, username: 'ana' },
        { id: cara.id, username: 'cara' },
      ],
      seats: [null, null, null, null],
    },
  });

  const rejoin = await room.join.post({}, bob);
  expect(rejoin.status).toBe(403);
  expect(rejoin.error?.value).toEqual({ error: 'removed_from_room' });
});

test('only the room owner starts, and only with four seats full', async () => {
  const { api, roomId, players } = await roomWith('bob', 'cara', 'dan');
  const room = api.rooms({ id: roomId });
  for (const [seat, p] of players.slice(0, 3).entries())
    await room.seat.put({ seat }, p);

  const notFull = await room.start.post({}, players[0]);
  expect(notFull.status).toBe(409);
  expect(notFull.error?.value).toEqual({ error: 'seats_not_full' });

  await room.seat.put({ seat: 3 }, players[3]);
  expect((await room.start.post({}, players[1])).status).toBe(403);
  expect((await room.start.post({}, players[0])).status).toBe(200);
});

test('when the room owner leaves, the next seated player becomes owner', async () => {
  const { api, roomId, players, connect } = await roomWith('bob', 'cara');
  const [ana, bob, cara] = players;
  assert(bob && cara);
  const room = api.rooms({ id: roomId });
  await room.seat.put({ seat: 1 }, ana);
  await room.seat.put({ seat: 0 }, cara);
  await room.seat.put({ seat: 3 }, bob);
  const anaSocket = await connect(roomId, ana);
  const caraSocket = await connect(roomId, cara);
  await anaSocket.next();
  await caraSocket.next();

  expect((await room.leave.post({}, ana)).status).toBe(200);
  expect(await anaSocket.next()).toBeUndefined();
  expect(await caraSocket.next()).toMatchObject({
    room: { ownerId: bob.id, seats: [cara.id, null, null, bob.id] },
  });
  expect((await room.patch({ targetScore: 501 }, bob)).status).toBe(200);
});

test('a player leaves a seat and stays in the room', async () => {
  const { api, roomId, players } = await roomWith('bob');
  const [, bob] = players;
  assert(bob);
  const room = api.rooms({ id: roomId });
  await room.seat.put({ seat: 2 }, bob);

  const { data } = await room.seat.delete({}, bob);
  expect(data?.seats).toEqual([null, null, null, null]);
  expect(data?.members.map((m) => m.username)).toEqual(['ana', 'bob']);
});

test('a room is gone once its last player leaves', async () => {
  const { api, roomId, players, player } = await roomWith();
  await api.rooms({ id: roomId }).leave.post({}, players[0]);

  const bob = await player('bob');
  const { status } = await api.rooms({ id: roomId }).join.post({}, bob);
  expect(status).toBe(404);
});

test('taking a seat in another room frees the seat in the first', async () => {
  const { api, roomId, players, connect } = await roomWith('bob');
  const [ana, bob] = players;
  assert(bob);
  await api.rooms({ id: roomId }).seat.put({ seat: 0 }, ana);
  const bobSocket = await connect(roomId, bob);
  await bobSocket.next();

  const { data: other } = await api.rooms.post({}, ana);
  assert(other);
  const { data } = await api.rooms({ id: other.id }).seat.put({ seat: 1 }, ana);
  expect(data?.seats).toEqual([null, ana.id, null, null]);
  expect(await bobSocket.next()).toMatchObject({
    room: {
      ownerId: bob.id,
      members: [{ id: bob.id, username: 'bob' }],
      seats: [null, null, null, null],
    },
  });
});

test('a player in a running match cannot take a seat in another room', async () => {
  const { api, room, players } = await table();
  await room.start.post({}, players[0]);

  const { data: other } = await api.rooms.post({}, players[0]);
  assert(other);
  const { status, error } = await api
    .rooms({ id: other.id })
    .seat.put({ seat: 0 }, players[0]);
  expect(status).toBe(409);
  expect(error?.value).toEqual({ error: 'seated_in_match' });
});

test('a spectator is in the room only while connected; ownership passes on', async () => {
  const { api, roomId, players, connect } = await roomWith('bob', 'cara');
  const [ana, bob, cara] = players;
  assert(bob && cara);
  await api.rooms({ id: roomId }).seat.put({ seat: 2 }, bob);
  const bobSocket = await connect(roomId, bob);
  await bobSocket.next();
  const tabs = [
    await connect(roomId, ana),
    await connect(roomId, ana),
  ] as const;
  for (const tab of tabs) await tab.next();

  tabs[0].ws.close();
  tabs[1].ws.close();
  expect(await bobSocket.next()).toMatchObject({
    room: {
      ownerId: bob.id,
      members: [
        { id: bob.id, username: 'bob' },
        { id: cara.id, username: 'cara' },
      ],
    },
  });
});

test('a seated room owner who goes away keeps the seat and the room', async () => {
  const { api, roomId, players, connect } = await roomWith('bob', 'cara');
  const [ana, bob, cara] = players;
  assert(bob && cara);
  await api.rooms({ id: roomId }).seat.put({ seat: 0 }, ana);
  const bobSocket = await connect(roomId, bob);
  await bobSocket.next();
  const anaSocket = await connect(roomId, ana);
  const caraSocket = await connect(roomId, cara);
  await anaSocket.next();
  await caraSocket.next();

  anaSocket.ws.close();
  caraSocket.ws.close();
  expect(await bobSocket.next()).toMatchObject({
    room: {
      ownerId: ana.id,
      members: [
        { id: ana.id, username: 'ana' },
        { id: bob.id, username: 'bob' },
      ],
      seats: [ana.id, null, null, null],
    },
  });
});

test('the account shows the seated room and whether its match is running', async () => {
  const { api, room, roomId, players } = await table();
  const seated = { id: roomId, owner: 'ana', seatsFilled: 4 };
  expect((await api.me.get(players[1])).data?.room).toEqual({
    ...seated,
    matchRunning: false,
  });

  await room.start.post({}, players[0]);
  expect((await api.me.get(players[1])).data?.room).toEqual({
    ...seated,
    matchRunning: true,
  });
  await room.leave.post({}, players[1]);
  expect((await api.me.get(players[1])).data?.room).toBeNull();
  expect((await api.me.get(players[0])).data?.room).toMatchObject({
    seatsFilled: 3,
    matchRunning: false,
  });
});
