import { expect, test } from 'bun:test';
import { nextOf, setup } from './test-setup';

// Ana's room with Bob and Cara in it, each with an open room socket.
const chatRoom = async () => {
  const ctx = await setup();
  const ana = await ctx.player('ana');
  const bob = await ctx.player('bob');
  const cara = await ctx.player('cara');
  const { data: room } = await ctx.api.rooms.post({}, ana);
  await ctx.api.rooms({ id: room!.id }).join.post({}, bob);
  await ctx.api.rooms({ id: room!.id }).join.post({}, cara);
  const open = async (session: typeof ana) => {
    const socket = await ctx.connect(room!.id, session);
    await socket.next();
    const send = (message: object) => socket.ws.send(JSON.stringify(message));
    return { ...socket, send };
  };
  return {
    ...ctx,
    roomId: room!.id,
    ana: { ...ana, socket: await open(ana) },
    bob: { ...bob, socket: await open(bob) },
    cara: { ...cara, socket: await open(cara) },
  };
};

test('a chat message reaches everyone in the room live', async () => {
  const { ana, bob, cara } = await chatRoom();

  ana.socket.send({ type: 'chat.send', text: '  good luck  ' });

  for (const player of [ana, bob, cara]) {
    expect(await player.socket.next()).toMatchObject({
      type: 'chat.message',
      message: { from: ana.id, text: 'good luck' },
    });
  }
});

test('mute hides a player for the muting player only; unmute restores them', async () => {
  const { ana, bob, cara } = await chatRoom();
  ana.socket.send({ type: 'chat.send', text: 'hello' });
  await bob.socket.next();
  await cara.socket.next();

  bob.socket.send({ type: 'chat.mute', playerId: ana.id });
  expect(await bob.socket.next()).toEqual({
    type: 'chat.history',
    messages: [],
    muted: [ana.id],
  });

  ana.socket.send({ type: 'chat.send', text: 'bob, are you there?' });
  cara.socket.send({ type: 'chat.send', text: 'he muted you' });
  expect(await cara.socket.next()).toMatchObject({
    message: { from: ana.id, text: 'bob, are you there?' },
  });
  expect(await bob.socket.next()).toMatchObject({
    message: { from: cara.id, text: 'he muted you' },
  });

  bob.socket.send({ type: 'chat.unmute', playerId: ana.id });
  expect(await bob.socket.next()).toMatchObject({
    type: 'chat.history',
    messages: [
      { from: ana.id, text: 'hello' },
      { from: ana.id, text: 'bob, are you there?' },
      { from: cara.id, text: 'he muted you' },
    ],
    muted: [],
  });
});

test('a newly opened room socket asks for recent chat, still without muted players', async () => {
  const { roomId, connect, ana, bob, cara } = await chatRoom();
  bob.socket.send({ type: 'chat.mute', playerId: cara.id });
  await bob.socket.next();
  ana.socket.send({ type: 'chat.send', text: 'one' });
  cara.socket.send({ type: 'chat.send', text: 'two' });
  await ana.socket.next();
  await ana.socket.next();

  const tab = await connect(roomId, bob);
  await tab.next();
  tab.ws.send(JSON.stringify({ type: 'chat.history' }));
  expect(await tab.next()).toMatchObject({
    type: 'chat.history',
    messages: [{ from: ana.id, text: 'one' }],
    muted: [cara.id],
  });
});

test('a malformed socket message is ignored', async () => {
  const { ana } = await chatRoom();
  ana.socket.ws.send('{not json');
  ana.socket.ws.send('null');
  ana.socket.send({ type: 5 });
  ana.socket.send({ type: 'chat.history' });
  expect(await ana.socket.next()).toMatchObject({ type: 'chat.history' });
  expect(ana.socket.isClosed()).toBe(false);
});

test('a message sent as soon as the room socket opens is not lost', async () => {
  const { roomId, connect, ana } = await chatRoom();
  ana.socket.send({ type: 'chat.send', text: 'early' });
  await ana.socket.next();

  const tab = await connect(roomId, ana);
  tab.ws.addEventListener('open', () =>
    tab.ws.send(JSON.stringify({ type: 'chat.history' })),
  );
  expect(await nextOf(tab, 'chat.history')).toMatchObject({
    messages: [{ from: ana.id, text: 'early' }],
  });
});
