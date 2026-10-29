# Coding standards

Tools check format, lint and types. Run them before you commit; the lefthook
`pre-commit` hook runs `bun fmt` and `oxlint` on staged files.

```sh
bun fmt          # format
bun run lint     # oxlint
bun run typecheck
bun run test
```

This page holds only the rules that the tools cannot check.

## Server modules

Put each server feature in `modules/<feature>/`:

| File                | Holds                             |
| ------------------- | --------------------------------- |
| `index.ts`          | Thin Elysia routes                |
| `model.ts`          | `t` schemas                       |
| `service.ts`        | Logic. It calls Drizzle directly. |
| `<feature>.test.ts` | Tests                             |

## Names and exports

- Use kebab-case file names.
- Use named exports only. Use a default export only where a tool requires
  it: `vite.config`, `svelte.config`, `drizzle.config`, and the server entry.
- Use `type` by default. Use `interface` only for objects that inherit from
  each other.

## Errors

- Throw typed error classes with snake_case codes.
- One global handler maps each error to `status + { error }`.
- Do not wrap responses in an envelope.

## Non-null assertions and casts

Lint warns on `!` and on unsafe `as`. Remove them in this order:

1. Fix the type at its source.
2. If the case truly cannot happen, use `assert` from `node:assert`. A failed
   assert returns 500.
3. If the case can happen, throw a typed error, such as a 404.

## Ternaries

Use a ternary only when the condition is one named boolean or a single
property, and both results are plain values. Anything more becomes a function
with `if` and early returns, or a `switch`.

## Comments

Write a comment only for:

- a belot rule that the code cannot name,
- a workaround, with its reason,
- a link to an ADR.

Do not write comments that restate the code.

## Readability

There is no line limit. In review, look for:

- a function that does several steps,
- nesting deeper than 2,
- flag arguments.

## Svelte

A screen that uses a socket keeps its state in a class in a `.svelte.ts` file.
