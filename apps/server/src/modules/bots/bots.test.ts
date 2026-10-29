import assert from 'node:assert';
import { expect, test } from 'bun:test';
import { belot, type BelotMove } from '@belot/engine';
import { botMove, botTurn, seatBot } from '#src/modules/bots/service';
import type { MatchMessage } from '#src/modules/matches/service';
import { Conflict } from '#src/plugins/errors';
import { nextOf, setup } from '#src/test/setup';

const pass = { type: 'pass' } as const;

const matchMessage = (
  legalMoves: BelotMove[],
  missing: string[] = [],
): MatchMessage => ({
  type: 'match',
  match: {
    seat: 0,
    players: [],
    view: belot.view(belot.setup({ targetScore: 501 }, 'seed'), 0),
    legalMoves,
    turn: 0,
    events: [],
    result: null,
    missing,
    ended: false,
    abandonedBy: null,
  },
});

test('a bot takes a free seat while bots are left', () => {
  const room = {
    members: ['ana', 'bot-1', 'bot-2'],
    seats: ['ana', 'bot-1', 'bot-2', null],
  };
  expect(() => seatBot(room, 0)).toThrow(new Conflict('seat_taken'));
  seatBot(room, 3);
  expect(room.seats).toEqual(['ana', 'bot-1', 'bot-2', 'bot-3']);
  room.seats[3] = null;
  expect(() => seatBot(room, 3)).toThrow(new Conflict('no_bot_left'));
});

test('a bot passes when it may', () => {
  expect(botMove([{ type: 'call', suit: 'hearts' }, pass])).toEqual(pass);
});

test('a bot plays only on its turn in a match that is not paused', () => {
  expect(
    botTurn(
      new Map([
        ['ana', matchMessage([pass])],
        ['bot-1', matchMessage([])],
        ['bot-2', matchMessage([pass])],
      ]),
    ),
  ).toEqual({ userId: 'bot-2', legalMoves: [pass] });
  expect(botTurn(new Map([['bot-1', matchMessage([pass], ['ana'])]]))).toBe(
    undefined,
  );
  expect(botTurn(new Map([['ana', matchMessage([pass])]]))).toBe(undefined);
});

test('a room owner seats bots, and bots play until it is the owner’s turn', async () => {
  const { api, player, connect } = await setup();
  const ana = await player('ana');
  const { data } = await api.rooms.post({}, ana);
  assert(data);
  const room = api.rooms({ id: data.id });
  await room.seat.put({ seat: 0 }, ana);
  for (const seat of [1, 2, 3]) {
    const { status } = await room.bots.post({ seat }, ana);
    expect(status).toBe(200);
  }
  const socket = await connect(data.id, ana);
  const { room: seated } = await nextOf(socket, 'room');
  expect(seated.seats).toEqual([ana.id, 'bot-1', 'bot-2', 'bot-3']);
  expect(seated.members.map((m) => m.username)).toEqual([
    'ana',
    'Bot 1',
    'Bot 2',
    'Bot 3',
  ]);

  expect((await room.start.post({}, ana)).status).toBe(200);
  // Bots never pause the match, and they move without anyone asking.
  for (;;) {
    const { match } = await nextOf(socket, 'match');
    expect(match.missing).toEqual([]);
    if (match.turn === 0) break;
  }
});

test('only the room owner seats a bot, and only in a free seat', async () => {
  const { api, player } = await setup();
  const ana = await player('ana');
  const bob = await player('bob');
  const { data } = await api.rooms.post({}, ana);
  assert(data);
  const room = api.rooms({ id: data.id });
  await room.join.post({}, bob);
  await room.seat.put({ seat: 0 }, ana);

  expect((await room.bots.post({ seat: 1 }, bob)).status).toBe(403);
  expect((await room.bots.post({ seat: 0 }, ana)).status).toBe(409);
});

test('a room with only bots left is gone', async () => {
  const { api, player } = await setup();
  const ana = await player('ana');
  const { data } = await api.rooms.post({}, ana);
  assert(data);
  const room = api.rooms({ id: data.id });
  await room.bots.post({ seat: 1 }, ana);

  await room.leave.post({}, ana);
  expect((await room.join.post({}, ana)).status).toBe(404);
});
