import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

export const rooms = pgTable('rooms', {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: timestamp().notNull().defaultNow(),
});
