import { expect, test } from 'bun:test';
import {
  createSockets,
  type RoomMessage,
  type Socket,
} from '#src/modules/sockets/service';

const removed: RoomMessage = { type: 'removed' };

// A socket that records what it gets.
const fake = (id: string, roomId: string, userId: string) => {
  const got: RoomMessage[] = [];
  let closed = false;
  const socket: Socket = {
    id,
    roomId,
    userId,
    send: (message) => got.push(message),
    close: () => {
      closed = true;
    },
  };
  return { socket, got, isClosed: () => closed };
};

test('each user gets their own message on every socket they have open in the room', () => {
  const sockets = createSockets();
  const tabs = [fake('1', 'r', 'ana'), fake('2', 'r', 'ana')];
  const bob = fake('3', 'r', 'bob');
  const elsewhere = fake('4', 'other', 'ana');
  for (const s of [...tabs, bob, elsewhere]) sockets.add(s.socket);

  const chat: RoomMessage = {
    type: 'chat.history',
    messages: [],
    muted: [],
  };
  sockets.sendEach(
    'r',
    new Map<string, RoomMessage>([
      ['ana', removed],
      ['bob', chat],
    ]),
  );

  expect(tabs.map((t) => t.got)).toEqual([[removed], [removed]]);
  expect(bob.got).toEqual([chat]);
  expect(elsewhere.got).toEqual([]);
});

test('a user removed from a room is told so, and only their sockets there close', () => {
  const sockets = createSockets();
  const ana = fake('1', 'r', 'ana');
  const bob = fake('2', 'r', 'bob');
  const elsewhere = fake('3', 'other', 'ana');
  for (const s of [ana, bob, elsewhere]) sockets.add(s.socket);

  sockets.sendTo({ roomId: 'r', userId: 'ana' }, removed);
  sockets.close({ roomId: 'r', userId: 'ana' });

  expect(ana.got).toEqual([removed]);
  expect(ana.isClosed()).toBe(true);
  expect(bob.got).toEqual([]);
  expect(bob.isClosed()).toBe(false);
  expect(elsewhere.isClosed()).toBe(false);
});

test("removing a socket tells when it was the user's last one in the room", () => {
  const sockets = createSockets();
  const tabs = [fake('1', 'r', 'ana'), fake('2', 'r', 'ana')];
  for (const s of [...tabs, fake('3', 'r', 'bob')]) sockets.add(s.socket);
  expect(sockets.connected('r')).toEqual(new Set(['ana', 'bob']));

  expect(sockets.remove('r', '1')).toBe(false);
  expect(sockets.connected('r')).toEqual(new Set(['ana', 'bob']));
  expect(sockets.remove('r', '2')).toBe(true);
  expect(sockets.connected('r')).toEqual(new Set(['bob']));
});

test('removing a socket that was never added is no last close', () => {
  const sockets = createSockets();
  expect(sockets.remove('r', '1')).toBe(false);
});
