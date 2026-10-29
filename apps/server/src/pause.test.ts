import { expect, test } from 'bun:test';
import type { MatchView } from '#src/app';
import { nextOf, send, setup, table, type Socket } from '#src/test-setup';

// The next match message once every seated player is connected again.
const resumed = async (socket: Socket) => {
  for (;;) {
    const { match } = await nextOf(socket, 'match');
    if (match.missing.length === 0) return match;
  }
};

// Plays the last legal move of the player on turn and returns the new views.
const step = async (sockets: Socket[], views: MatchView[]) => {
  const turn = views[0]!.turn!;
  send(sockets[turn]!, views[turn]!.legalMoves.at(-1));
  return (await Promise.all(sockets.map((s) => nextOf(s, 'match')))).map(
    (m) => m.match,
  );
};

const started = async () => {
  const ctx = await table();
  await ctx.room.start.post({}, ctx.players[0]!);
  const views = await Promise.all(ctx.sockets.map((s) => nextOf(s, 'match')));
  return { ...ctx, views: views.map((m) => m.match) };
};

test('after a server restart, an ongoing match goes on with the same state', async () => {
  const before = await table();
  const { room, roomId, players, sockets } = before;
  await room.patch({ targetScore: 501 }, players[0]!);
  await room.start.post({}, players[0]!);
  let views = (await Promise.all(sockets.map((s) => nextOf(s, 'match')))).map(
    (m) => m.match,
  );
  // Into the second deal.
  for (let i = 0; i < 40; i++) views = await step(sockets, views);

  await before.app.stop(true);
  const after = await setup(before.db);
  const again: Socket[] = [];
  for (const p of players) again.push(await after.connect(roomId, p));
  const rebuilt = await Promise.all(again.map(resumed));
  for (const [seat, match] of rebuilt.entries()) {
    expect(match).toEqual({ ...views[seat]!, events: [] });
  }

  views = rebuilt;
  while (!views[0]!.result) views = await step(again, views);
  const { winner, scores } = views[0]!.result!;
  expect(scores[winner]).toBeGreaterThanOrEqual(501);
  expect(scores[winner]).toBeLessThan(1001);
});

test('a disconnect pauses the match and shows who is missing', async () => {
  const { players, sockets, views } = await started();
  const turn = views[0]!.turn!;
  const gone = (turn + 1) % 4;

  sockets[gone]!.ws.close();
  for (const [seat, socket] of sockets.entries()) {
    if (seat === gone) continue;
    const { match } = await nextOf(socket, 'match');
    expect(match.missing).toEqual([players[gone]!.id]);
    expect(match.view).toEqual(views[seat]!.view);
  }

  send(sockets[turn]!, views[turn]!.legalMoves[0]);
  expect(await nextOf(sockets[turn]!, 'match.rejected')).toEqual({
    type: 'match.rejected',
    reason: 'paused',
  });
});

test('a player who rejoins gets the same seat and hand, and play goes on', async () => {
  const { roomId, players, sockets, views, connect } = await started();
  const turn = views[0]!.turn!;
  const gone = (turn + 1) % 4;
  sockets[gone]!.ws.close();
  const waiting = sockets.filter((_, seat) => seat !== gone);
  for (const socket of waiting) await nextOf(socket, 'match');

  sockets[gone] = await connect(roomId, players[gone]!);
  const back = await resumed(sockets[gone]!);
  expect(back).toEqual(views[gone]!);
  for (const socket of waiting) await resumed(socket);

  const next = await step(sockets, views);
  expect(next[0]!.events.length).toBeGreaterThan(0);
});

test('any seated player can end a paused match for all players', async () => {
  const { room, roomId, players, sockets, connect } = await started();
  const end = (socket: Socket) =>
    socket.ws.send(JSON.stringify({ type: 'match.end' }));

  end(sockets[1]!);
  expect(await nextOf(sockets[1]!, 'match.rejected')).toEqual({
    type: 'match.rejected',
    reason: 'not_paused',
  });

  sockets[3]!.ws.close();
  for (const socket of sockets.slice(0, 3)) await nextOf(socket, 'match');
  end(sockets[1]!);
  for (const socket of sockets.slice(0, 3)) {
    const { match } = await nextOf(socket, 'match');
    expect(match.ended).toBe(true);
    expect(match.turn).toBeNull();
    expect(match.legalMoves).toEqual([]);
  }

  sockets[3] = await connect(roomId, players[3]!);
  expect((await nextOf(sockets[3]!, 'match')).match.ended).toBe(true);
  expect((await room.seat.delete({}, players[2]!)).status).toBe(200);
  expect((await room.seat.put({ seat: 2 }, players[2]!)).status).toBe(200);
  expect((await room.start.post({}, players[0]!)).status).toBe(200);
  const { match } = await nextOf(sockets[0]!, 'match');
  expect(match.ended).toBe(false);
  expect(match.view.hand).toHaveLength(6);
});

test('a player who leaves the room mid-match abandons it: it ends for everyone and frees the seat', async () => {
  const { room, players, sockets } = await started();

  expect((await room.leave.post({}, players[1]!)).status).toBe(200);
  const { match } = await nextOf(sockets[0]!, 'match');
  expect(match).toMatchObject({
    ended: true,
    abandonedBy: players[1]!.id,
    legalMoves: [],
  });
  const { room: after } = await nextOf(sockets[0]!, 'room');
  expect(after.seats).toEqual([
    players[0]!.id,
    null,
    players[2]!.id,
    players[3]!.id,
  ]);
  expect((await room.start.post({}, players[0]!)).error?.value).toEqual({
    error: 'seats_not_full',
  });
});

test('after an abandon the leaver can take a seat again at once', async () => {
  const { room, players } = await started();
  await room.leave.post({}, players[1]!);

  await room.join.post({}, players[1]!);
  expect((await room.seat.put({ seat: 1 }, players[1]!)).status).toBe(200);
});

test('a socket that closes while it opens still leaves the player missing', async () => {
  const { roomId, players, sockets, connect } = await started();
  sockets[1]!.ws.close();
  await nextOf(sockets[0]!, 'match');

  const quick = await connect(roomId, players[1]!);
  quick.ws.addEventListener('open', () => quick.ws.close());
  while (!quick.isClosed()) await quick.next();

  const again = await connect(roomId, players[0]!);
  const { match } = await nextOf(again, 'match');
  expect(match.missing).toEqual([players[1]!.id]);
});
