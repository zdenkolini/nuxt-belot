# Own eden query layer, not OpenAPI codegen

The web app calls the server through eden treaty, wrapped in our own small TanStack Query layer (`createEdenQuery`, `createEdenMutation`, `edenKey`, `edenCall`). Routes are named by a typed path recorder over `App['~Routes']`, such as `routes.rooms[':id'].seat.put`, and request fields are `params`, `query` and `body`, each present in the type only when the route has it. Query keys are `['belot', ...path, { params, query }]`, so a mutation invalidates its controller (`['belot', 'rooms']`) by default.

We rejected Kubb generating TanStack code from an Elysia OpenAPI spec. As of 2026-10:

- Kubb v5 has no Svelte Query plugin. The v4 plugin targets the pre-runes `createQuery({...})` API.
- Kubb's Vite plugin runs only during `vite build`, not during dev.
- The spec has success types for one route only, and `fromTypes()` fails on this repo.
- The room WebSocket is not in OpenAPI, so eden would stay anyway.

Eden already infers request, success and error types with no build step. The cost is our own ~100 lines of type-level code, and a dependency on Elysia's `~Routes` type, which eden itself also reads. Revisit if Kubb ships a Svelte Query plugin for v5 and the routes gain `response` schemas.
