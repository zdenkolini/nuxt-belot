import assert from 'node:assert';
import { expect, test } from 'bun:test';
import { Elysia, t } from 'elysia';
import { errors, NotFound } from '#src/plugins/errors';

const app = new Elysia()
  .use(errors)
  .get('/typed', () => {
    throw new NotFound('room_not_found');
  })
  .get('/assert', () => {
    assert(false);
  })
  .get('/unknown', () => {
    throw new Error('boom');
  })
  .get('/validated', () => 'ok', { query: t.Object({ n: t.Numeric() }) });

const get = async (path: string) => {
  const res = await app.handle(new Request(`http://localhost${path}`));
  return { status: res.status, body: await res.json() };
};

test('a typed error returns its status and code', async () => {
  expect(await get('/typed')).toEqual({
    status: 404,
    body: { error: 'room_not_found' },
  });
});

test('a failed assert returns 500', async () => {
  expect(await get('/assert')).toEqual({
    status: 500,
    body: { error: 'internal_error' },
  });
});

test('an unknown error returns 500', async () => {
  expect(await get('/unknown')).toEqual({
    status: 500,
    body: { error: 'internal_error' },
  });
});

test('a validation error keeps its own response', async () => {
  const { status } = await get('/validated');
  expect(status).toBe(422);
});
