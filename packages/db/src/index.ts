import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';

export * from './schema';

// No dataDir gives an in-memory database.
export const createDb = async (dataDir?: string) => {
  const db = drizzle({
    client: new PGlite(dataDir),
    schema,
    casing: 'snake_case',
  });
  await migrate(db, {
    migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
  });
  return db;
};

export type Db = Awaited<ReturnType<typeof createDb>>;
