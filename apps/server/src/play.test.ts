import { expect, test } from 'bun:test';
import type { BelotMove, Declaration } from '@belot/engine';
import { nextOf, send, table } from './test-setup';

type PlayMove = Extract<BelotMove, { type: 'play' }>;

test('starting a match sends each seat its own view and nothing of the seed', async () => {
  const { room, players, sockets } = await table();

  const { status } = await room.start.post({}, players[0]!);
  expect(status).toBe(200);

  for (const [seat, socket] of sockets.entries()) {
    const message = await nextOf(socket, 'match');
    expect<number>(message.match.seat).toBe(seat);
    expect(message.match.view.hand).toHaveLength(6);
    expect(message.match.view.cardCounts).toEqual([6, 6, 6, 6]);
    expect(message.match.result).toBeNull();
    expect(JSON.stringify(message)).not.toContain('seed');
  }
});

test('the server rejects moves out of turn and illegal moves, and applies legal ones', async () => {
  const { room, players, sockets } = await table();
  await room.start.post({}, players[0]!);
  const views = await Promise.all(sockets.map((s) => nextOf(s, 'match')));
  const turn = views[0]!.match.turn!;
  const waiting = (turn + 1) % 4;

  send(sockets[waiting]!, { type: 'pass' });
  expect(await nextOf(sockets[waiting]!, 'match.rejected')).toEqual({
    type: 'match.rejected',
    reason: 'not_your_turn',
  });

  send(sockets[turn]!, { type: 'play', card: views[turn]!.match.view.hand[0] });
  expect(await nextOf(sockets[turn]!, 'match.rejected')).toEqual({
    type: 'match.rejected',
    reason: 'illegal_move',
  });

  send(sockets[turn]!, { type: 'call', suit: 'hearts' });
  const called = [];
  for (const socket of sockets) {
    const { match } = await nextOf(socket, 'match');
    expect(match.view.trump).toBe('hearts');
    expect<number | null>(match.view.caller).toBe(turn);
    expect(match.events).toEqual([
      { type: 'called', seat: turn, suit: 'hearts' },
    ]);
    called.push(match);
  }

  const leader = called[0]!.turn!;
  send(sockets[leader]!, { type: 'play' });
  send(sockets[leader]!, { type: 'play', card: { id: 'joker' } });
  expect(await nextOf(sockets[leader]!, 'match.rejected')).toMatchObject({
    reason: 'illegal_move',
  });
  expect(await nextOf(sockets[leader]!, 'match.rejected')).toMatchObject({
    reason: 'illegal_move',
  });
  const move = called[leader]!.legalMoves[0] as PlayMove;
  send(sockets[leader]!, move);
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
  await room.start.post({}, players[0]!);
  const { match } = await nextOf(sockets[1]!, 'match');

  expect((await room.seat.delete({}, players[1]!)).error?.value).toEqual({
    error: 'match_running',
  });
  expect((await room.seat.put({ seat: 0 }, players[1]!)).status).toBe(409);

  sockets[1]!.ws.close();
  const again = await connect(roomId, players[1]!);
  await nextOf(again, 'room');
  expect((await nextOf(again, 'match')).match).toEqual(match);
});

test('four players play a full match to the target score, each seeing only their own hand, then play again', async () => {
  const { room, players, sockets } = await table();
  const [ana] = players;
  await room.patch({ targetScore: 501 }, ana!);
  await room.start.post({}, ana!);
  let views = await Promise.all(sockets.map((s) => nextOf(s, 'match')));
  expect((await room.start.post({}, ana!)).error?.value).toEqual({
    error: 'match_running',
  });

  let dealsScored = 0;
  while (!views[0]!.match.result) {
    const turn = views[0]!.match.turn!;
    send(sockets[turn]!, views[turn]!.match.legalMoves.at(-1));
    views = await Promise.all(sockets.map((s) => nextOf(s, 'match')));
    if (views[0]!.match.events.some((e) => e.type === 'dealScored'))
      dealsScored++;

    for (const [seat, { match }] of views.entries()) {
      expect<number>(match.seat).toBe(seat);
      expect(match.view.hand).toHaveLength(match.view.cardCounts[seat]!);
      // Declared cards are public, and the last card of a deal is dealt again.
      const announced = [
        ...match.view.declarations.flatMap((d) => d.cards.map((c) => c.id)),
        ...match.events.flatMap((e) =>
          e.type === 'played' ? [e.card.id] : [],
        ),
      ];
      const others = views
        .filter((_, other) => other !== seat)
        .flatMap((v) => v.match.view.hand.map((c) => c.id))
        .filter((id) => !announced.includes(id));
      const sent = JSON.stringify(match);
      for (const id of others) expect(sent).not.toContain(id);
      expect(sent).not.toContain('seed');
    }
  }

  const { result } = views[0]!.match;
  expect(dealsScored).toBeGreaterThan(0);
  expect(result!.scores[result!.winner]).toBeGreaterThanOrEqual(501);
  for (const { match } of views) {
    expect(match.result).toEqual(result);
    expect(match.turn).toBeNull();
  }

  expect((await room.start.post({}, ana!)).status).toBe(200);
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
  await room.patch({ targetScore: 501 }, ana!);
  await room.start.post({}, ana!);
  let views = await Promise.all(sockets.map((s) => nextOf(s, 'match')));

  let declared: Declaration[] = [];
  let belote: number | null = null;
  let announced = 0;
  while (announced === 0 || !views[0]!.match.result) {
    if (views[0]!.match.result) {
      await room.start.post({}, ana!);
    } else {
      const turn = views[0]!.match.turn!;
      send(sockets[turn]!, views[turn]!.match.legalMoves.at(-1));
    }
    views = await Promise.all(sockets.map((s) => nextOf(s, 'match')));

    // A new deal starts after each deal score, except the last of the match.
    const { events, result } = views[0]!.match;
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

    for (const { match } of views) {
      expect(match.view.declarations).toEqual(declared);
      expect<number | null>(match.view.belote).toBe(belote);
      const scoring = match.view.declarationPoints.filter((p) => p > 0);
      expect(scoring).toHaveLength(declared.length > 0 ? 1 : 0);
    }
  }
});
