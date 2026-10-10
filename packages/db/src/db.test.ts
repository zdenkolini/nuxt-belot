import { expect, test } from 'bun:test';
import { createDb, rooms } from './index';

test('a new in-memory database is migrated and stores rooms', async () => {
  const db = await createDb();
  const [room] = await db.insert(rooms).values({}).returning();
  expect(room?.id).toBeString();
  expect(await db.select().from(rooms)).toEqual([room!]);
});
