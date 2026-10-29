import assert from 'node:assert';
import { expect, test } from 'bun:test';
import { matches, type Db } from '@belot/db';
import { belot, type Declaration, type Seat } from '@belot/engine';
import { desc } from 'drizzle-orm';
import type { MatchView } from '#src/app';
import {
  isBelotMove,
  isBelotVariant,
  isSeat,
  missingOf,
  seatFor,
  turnOf,
} from '#src/modules/matches/service';
import { nextOf, send, setup, table, type Socket } from '#src/test/setup';

type Four<T> = [T, T, T, T];

const seats = [0, 1, 2, 3] as const;

const eachSeat = <T>(
  sockets: Four<Socket>,
  f: (socket: Socket) => Promise<T>,
) => Promise.all([f(sockets[0]), f(sockets[1]), f(sockets[2]), f(sockets[3])]);

const matchOf = async (socket: Socket) => (await nextOf(socket, 'match')).match;

const nextMatches = (sockets: Four<Socket>) => eachSeat(sockets, matchOf);

const nextSeat = (seat: Seat) => {
  const next = (seat + 1) % 4;
  assert(isSeat(next));
  return next;
};

// The seed of the last started match, as saved.
const lastSeed = async (db: Db) => {
  const [match] = await db
    .select({ seed: matches.seed })
    .from(matches)
    .orderBy(desc(matches.createdAt))
    .limit(1);
  assert(match);
  return match.seed;
};

test('starting a match sends each seat its own view and nothing of the seed', async () => {
  const { db, room, players, sockets } = await table();

  const { status } = await room.start.post({}, players[0]);
  expect(status).toBe(200);
  const seed = await lastSeed(db);
  expect(seed).toMatch(/^[0-9a-f]{32}$/);

  for (const [seat, socket] of sockets.entries()) {
    const message = await nextOf(socket, 'match');
    expect<number>(message.match.seat).toBe(seat);
    expect(message.match.view.hand).toHaveLength(6);
    expect(message.match.view.cardCounts).toEqual([6, 6, 6, 6]);
    expect(message.match.result).toBeNull();
    expect(JSON.stringify(message)).not.toContain(seed);
  }
});

test('the server rejects moves out of turn and illegal moves, and applies legal ones', async () => {
  const { room, players, sockets } = await table();
  await room.start.post({}, players[0]);
  const views = await nextMatches(sockets);
  const turn = views[0].turn;
  assert(turn !== null);
  const waiting = nextSeat(turn);

  send(sockets[waiting], { type: 'pass' });
  expect(await nextOf(sockets[waiting], 'match.rejected')).toEqual({
    type: 'match.rejected',
    reason: 'not_your_turn',
  });

  send(sockets[turn], { type: 'play', card: views[turn].view.hand[0] });
  expect(await nextOf(sockets[turn], 'match.rejected')).toEqual({
    type: 'match.rejected',
    reason: 'illegal_move',
  });

  send(sockets[turn], { type: 'call', suit: 'hearts' });
  const called = await nextMatches(sockets);
  for (const match of called) {
    expect(match.view.trump).toBe('hearts');
    expect<number | null>(match.view.caller).toBe(turn);
    expect(match.events).toEqual([
      { type: 'called', seat: turn, suit: 'hearts' },
    ]);
  }

  const leader = called[0].turn;
  assert(leader !== null);
  send(sockets[leader], { type: 'play' });
  send(sockets[leader], { type: 'play', card: { id: 'joker' } });
  expect(await nextOf(sockets[leader], 'match.rejected')).toMatchObject({
    reason: 'illegal_move',
  });
  expect(await nextOf(sockets[leader], 'match.rejected')).toMatchObject({
    reason: 'illegal_move',
  });
  const move = called[leader].legalMoves[0];
  assert(move?.type === 'play');
  send(sockets[leader], move);
  for (const socket of sockets) {
    const { match } = await nextOf(socket, 'match');
    expect(match.events).toContainEqual({
      type: 'played',
      seat: leader,
      card: move.card,
    });
  }
});

test('seats stay fixed while a match runs, and a reopened socket gets the current view', async () => {
  const { room, roomId, players, sockets, connect } = await table();
  await room.start.post({}, players[0]);
  const { match } = await nextOf(sockets[1], 'match');

  expect((await room.seat.delete({}, players[1])).error?.value).toEqual({
    error: 'match_running',
  });
  expect((await room.seat.put({ seat: 0 }, players[1])).status).toBe(409);

  sockets[1].ws.close();
  const again = await connect(roomId, players[1]);
  await nextOf(again, 'room');
  expect((await nextOf(again, 'match')).match).toEqual(match);
});

test('four players play a full match to the target score, each seeing only their own hand, then play again', async () => {
  const { db, room, players, sockets } = await table();
  const [ana] = players;
  await room.patch({ targetScore: 501 }, ana);
  await room.start.post({}, ana);
  const seed = await lastSeed(db);
  let views = await nextMatches(sockets);
  expect((await room.start.post({}, ana)).error?.value).toEqual({
    error: 'match_running',
  });

  let dealsScored = 0;
  while (!views[0].result) {
    const turn = views[0].turn;
    assert(turn !== null);
    send(sockets[turn], views[turn].legalMoves.at(-1));
    views = await nextMatches(sockets);
    if (views[0].events.some((e) => e.type === 'dealScored')) dealsScored++;

    for (const [seat, match] of views.entries()) {
      expect<number>(match.seat).toBe(seat);
      expect(match.view.cardCounts[seat]).toBe(match.view.hand.length);
      // Declared cards are public, and the last card of a deal is dealt again.
      const announced = [
        ...match.view.declarations.flatMap((d) => d.cards.map((c) => c.id)),
        ...match.events.flatMap((e) =>
          e.type === 'played' ? [e.card.id] : [],
        ),
      ];
      const others = views
        .filter((_, other) => other !== seat)
        .flatMap((v) => v.view.hand.map((c) => c.id))
        .filter((id) => !announced.includes(id));
      const sent = JSON.stringify(match);
      for (const id of others) expect(sent).not.toContain(id);
      expect(sent).not.toContain(seed);
    }
  }

  const { result } = views[0];
  assert(result);
  expect(dealsScored).toBeGreaterThan(0);
  expect(result.scores[result.winner]).toBeGreaterThanOrEqual(501);
  for (const match of views) {
    expect(match.result).toEqual(result);
    expect(match.turn).toBeNull();
  }

  expect((await room.start.post({}, ana)).status).toBe(200);
  for (const socket of sockets) {
    const { match } = await nextOf(socket, 'match');
    expect(match.result).toBeNull();
    expect(match.view.scores).toEqual([0, 0]);
    expect(match.view.hand).toHaveLength(6);
  }
});

test('declarations and the belote appear in every view only once announced', async () => {
  const { room, players, sockets } = await table();
  const [ana] = players;
  await room.patch({ targetScore: 501 }, ana);
  await room.start.post({}, ana);
  let views = await nextMatches(sockets);

  let declared: Declaration[] = [];
  let belote: number | null = null;
  let announced = 0;
  while (announced === 0 || !views[0].result) {
    if (views[0].result) {
      await room.start.post({}, ana);
    } else {
      const turn = views[0].turn;
      assert(turn !== null);
      send(sockets[turn], views[turn].legalMoves.at(-1));
    }
    views = await nextMatches(sockets);

    // A new deal starts after each deal score, except the last of the match.
    const { events, result } = views[0];
    if (events.length === 0) [declared, belote] = [[], null];
    for (const event of events) {
      if (event.type === 'declared') {
        declared = event.declarations;
        announced++;
      }
      if (event.type === 'belote') belote = event.seat;
      if (event.type === 'dealScored' && !result)
        [declared, belote] = [[], null];
    }

    for (const match of views) {
      expect(match.view.declarations).toEqual(declared);
      expect<number | null>(match.view.belote).toBe(belote);
      const scoring = match.view.declarationPoints.filter((p) => p > 0);
      expect(scoring).toHaveLength(declared.length > 0 ? 1 : 0);
    }
  }
});

test('only 0 to 3 are seats', () => {
  expect([-1, 0, 1, 2, 3, 4].filter(isSeat)).toEqual([0, 1, 2, 3]);
});

test('a belot move is a pass, a call of a suit, or a play of a deck card', () => {
  const card = { id: 'ace-hearts', suit: 'hearts', rank: 'ace' } as const;
  expect(
    [
      { type: 'pass' },
      { type: 'call', suit: 'hearts' },
      { type: 'play', card },
      { type: 'call', suit: 'joker' },
      { type: 'play' },
      { type: 'play', card: { id: 'ace-hearts' } },
      { type: 'play', card: { ...card, suit: 'spades' } },
      { type: 'pass', extra: 1 },
      { type: 'fold' },
      'pass',
      null,
    ].filter(isBelotMove),
  ).toEqual([
    { type: 'pass' },
    { type: 'call', suit: 'hearts' },
    { type: 'play', card },
  ]);
});

test('a belot variant has one of the target scores', () => {
  expect(
    [
      { targetScore: 501 },
      { targetScore: 1001 },
      { targetScore: 500 },
      { targetScore: '501' },
      {},
      null,
    ].filter(isBelotVariant),
  ).toEqual([{ targetScore: 501 }, { targetScore: 1001 }]);
});

test('a player has the seat of their place, others have none', () => {
  const players = ['ana', 'bob', 'cid', 'dan'].map((id) => ({
    id,
    username: null,
  }));
  expect(seatFor(players, 'cid')).toBe(2);
  expect(seatFor(players, 'eve')).toBeUndefined();
});

test('the turn is the one seat with legal moves', () => {
  const state = belot.setup({ targetScore: 501 }, 'seed');
  const turn = turnOf(state);
  expect(turn).not.toBeNull();
  for (const seat of seats) {
    expect(belot.legalMoves(state, seat).length > 0).toBe(seat === turn);
  }
});

test('seated players without a socket are missing, bots never are', () => {
  expect(missingOf(['ana', 'bot-1', 'bob'], new Set(['ana']))).toEqual(['bob']);
});

// The next match message once every seated player is connected again.
const resumed = async (socket: Socket) => {
  for (;;) {
    const { match } = await nextOf(socket, 'match');
    if (match.missing.length === 0) return match;
  }
};

// Plays the last legal move of the player on turn and returns the new views.
const step = async (sockets: Four<Socket>, views: Four<MatchView>) => {
  const turn = views[0].turn;
  assert(turn !== null);
  send(sockets[turn], views[turn].legalMoves.at(-1));
  return nextMatches(sockets);
};

const started = async () => {
  const ctx = await table();
  await ctx.room.start.post({}, ctx.players[0]);
  return { ...ctx, views: await nextMatches(ctx.sockets) };
};

test('after a server restart, an ongoing match goes on with the same state', async () => {
  const before = await table();
  const { room, roomId, players, sockets } = before;
  await room.patch({ targetScore: 501 }, players[0]);
  await room.start.post({}, players[0]);
  let views = await nextMatches(sockets);
  // Into the second deal.
  for (let i = 0; i < 40; i++) views = await step(sockets, views);

  await before.app.stop(true);
  const restarted = await setup(before.db);
  const again: Four<Socket> = [
    await restarted.connect(roomId, players[0]),
    await restarted.connect(roomId, players[1]),
    await restarted.connect(roomId, players[2]),
    await restarted.connect(roomId, players[3]),
  ];
  const rebuilt = await eachSeat(again, resumed);
  expect<MatchView[]>(rebuilt).toEqual(
    views.map((match) => ({ ...match, events: [] })),
  );

  views = rebuilt;
  while (!views[0].result) views = await step(again, views);
  const { result } = views[0];
  assert(result);
  const { winner, scores } = result;
  expect(scores[winner]).toBeGreaterThanOrEqual(501);
  expect(scores[winner]).toBeLessThan(1001);
});

test('a disconnect pauses the match and shows who is missing', async () => {
  const { players, sockets, views } = await started();
  const turn = views[0].turn;
  assert(turn !== null);
  const gone = nextSeat(turn);

  sockets[gone].ws.close();
  for (const seat of seats) {
    if (seat === gone) continue;
    const { match } = await nextOf(sockets[seat], 'match');
    expect(match.missing).toEqual([players[gone].id]);
    expect(match.view).toEqual(views[seat].view);
  }

  send(sockets[turn], views[turn].legalMoves[0]);
  expect(await nextOf(sockets[turn], 'match.rejected')).toEqual({
    type: 'match.rejected',
    reason: 'paused',
  });
});

test('a player who rejoins gets the same seat and hand, and play goes on', async () => {
  const { roomId, players, sockets, views, connect } = await started();
  const turn = views[0].turn;
  assert(turn !== null);
  const gone = nextSeat(turn);
  sockets[gone].ws.close();
  const waiting = sockets.filter((_, seat) => seat !== gone);
  for (const socket of waiting) await nextOf(socket, 'match');

  sockets[gone] = await connect(roomId, players[gone]);
  const back = await resumed(sockets[gone]);
  expect(back).toEqual(views[gone]);
  for (const socket of waiting) await resumed(socket);

  const next = await step(sockets, views);
  expect(next[0].events.length).toBeGreaterThan(0);
});

test('any seated player can end a paused match for all players', async () => {
  const { room, roomId, players, sockets, connect } = await started();
  const end = (socket: Socket) =>
    socket.ws.send(JSON.stringify({ type: 'match.end' }));

  end(sockets[1]);
  expect(await nextOf(sockets[1], 'match.rejected')).toEqual({
    type: 'match.rejected',
    reason: 'not_paused',
  });

  sockets[3].ws.close();
  for (const socket of sockets.slice(0, 3)) await nextOf(socket, 'match');
  end(sockets[1]);
  for (const socket of sockets.slice(0, 3)) {
    const { match } = await nextOf(socket, 'match');
    expect(match.ended).toBe(true);
    expect(match.turn).toBeNull();
    expect(match.legalMoves).toEqual([]);
  }

  sockets[3] = await connect(roomId, players[3]);
  expect((await nextOf(sockets[3], 'match')).match.ended).toBe(true);
  expect((await room.seat.delete({}, players[2])).status).toBe(200);
  expect((await room.seat.put({ seat: 2 }, players[2])).status).toBe(200);
  expect((await room.start.post({}, players[0])).status).toBe(200);
  const { match } = await nextOf(sockets[0], 'match');
  expect(match.ended).toBe(false);
  expect(match.view.hand).toHaveLength(6);
});

test('a player who leaves the room mid-match abandons it: it ends for everyone and frees the seat', async () => {
  const { room, players, sockets } = await started();

  expect((await room.leave.post({}, players[1])).status).toBe(200);
  const { match } = await nextOf(sockets[0], 'match');
  expect(match).toMatchObject({
    ended: true,
    abandonedBy: players[1].id,
    legalMoves: [],
  });
  const { room: after } = await nextOf(sockets[0], 'room');
  expect(after.seats).toEqual([
    players[0].id,
    null,
    players[2].id,
    players[3].id,
  ]);
  expect((await room.start.post({}, players[0])).error?.value).toEqual({
    error: 'seats_not_full',
  });
});

test('after an abandon the leaver can take a seat again at once', async () => {
  const { room, players } = await started();
  await room.leave.post({}, players[1]);

  await room.join.post({}, players[1]);
  expect((await room.seat.put({ seat: 1 }, players[1])).status).toBe(200);
});

test('a socket that closes while it opens still leaves the player missing', async () => {
  const { roomId, players, sockets, connect } = await started();
  sockets[1].ws.close();
  await nextOf(sockets[0], 'match');

  const quick = await connect(roomId, players[1]);
  quick.ws.addEventListener('open', () => quick.ws.close());
  while (!quick.isClosed()) await quick.next();

  const again = await connect(roomId, players[0]);
  const { match } = await nextOf(again, 'match');
  expect(match.missing).toEqual([players[1].id]);
});
