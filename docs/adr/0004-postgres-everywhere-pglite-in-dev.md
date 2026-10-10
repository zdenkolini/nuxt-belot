# Postgres everywhere, PGlite in development

We use one Postgres schema and one migration set in every environment: PGlite (embedded Postgres in WASM) for development and tests, Railway Postgres in production, swapped by driver inside `packages/db`. We rejected SQLite in dev with Postgres in prod because Drizzle schemas are dialect-specific, which would mean two schemas, two migration sets, and production-only bugs.
