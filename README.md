# nuxt-belot

Online multiplayer belot. Bun workspaces monorepo:

- `packages/engine`: card game rules as pure functions
- `packages/db`: Drizzle schema and migrations (PGlite in dev and tests)
- `apps/server`: Elysia API
- `apps/web`: SvelteKit static app

```bash
bun install
bun run test       # all tests
bun run typecheck  # all type checks
bun run --filter @belot/server dev
bun run --filter @belot/web dev
```
