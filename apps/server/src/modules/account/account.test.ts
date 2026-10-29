import { expect, test } from 'bun:test';
import { checkRename } from '#src/modules/account/service';
import { Forbidden, TooManyRequests } from '#src/plugins/errors';

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
