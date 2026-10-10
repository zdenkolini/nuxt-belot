import { expect, test } from 'bun:test';
import { createDb, rooms, user } from './index';

test('a new in-memory database is migrated and stores rooms', async () => {
  const db = await createDb();
  await db
    .insert(user)
    .values({ id: 'u1', name: 'Ana', email: 'ana@example.com' });
  const [room] = await db
    .insert(rooms)
    .values({ ownerId: 'u1', members: ['u1'], seats: [null, null, null, null] })
    .returning();
  expect(room?.id).toBeString();
  expect(await db.select().from(rooms)).toEqual([room!]);
});
