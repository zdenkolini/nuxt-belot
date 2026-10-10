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
bun run dev        # server (:3000) and web (:5173) together
mprocs             # same, in a TUI with one pane per process
```

`mprocs` is optional: `brew install mprocs`.
