import { expect, test } from 'bun:test';
import { setup } from '#src/test/setup';

test('health endpoint reports ok', async () => {
  const { api } = await setup();
  const { data, status } = await api.health.get();
  expect(status).toBe(200);
  expect(data).toEqual({ status: 'ok' });
});
