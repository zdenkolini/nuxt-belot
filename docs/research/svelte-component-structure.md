# Svelte 5 component structure

Research for the `apps/web` refactor. Question: how do well-built Svelte 5 and
SvelteKit projects structure components so they are easy to read? Sources are
the svelte.dev docs and the source of real Svelte 5 codebases (list at the
end). Checked 2026-10-29.

## Summary for this repo

Already decided: feature folders, no `api` in components, a socket screen keeps
state in a class in `.svelte.ts`, pure logic in `.ts` with `bun test`. The
sources support all four. Add these rules:

1. **One state class per socket screen, shared by context.** The room page
   makes a `RoomState`, calls `setRoomState(room)` from a `createContext` pair,
   and children read it. Leaf components (`playing-card`, `suit-pip`,
   `deal-score`) keep plain props. This is the bits-ui pattern: parts read the
   root's context, primitives take props.
2. **Connect in an `$effect` keyed on the room id.** SvelteKit reuses the page
   component when you go from `/rooms/a` to `/rooms/b`, so connect and close
   must follow `id`: `$effect(() => room.connect(id))`, and `connect` returns
   the teardown.
3. **Move the event folding out of the page.** `onMatch` (page lines 49-71)
   and `failureNotice` (126-132) become pure functions in `match/` and
   `rooms/` with `bun test`. The class calls them.
4. **Split by visual region.** Each region with its own markup and its own
   derived values becomes a component in the feature folder, prefixed with the
   feature (`match-hand.svelte`), as shadcn-svelte does with `block-viewer-*`.
   Keep a snippet only for small markup that is used more than once in one
   file and has no state of its own.
5. **Kebab-case files, PascalCase imports.** The repo rule matches
   shadcn-svelte and bits-ui. The Svelte team uses PascalCase files. Both work.
6. **One script order** (see Q5).

### Proposed tree

```
lib/
  rooms/
    room-state.svelte.ts      RoomState class + [getRoomState, setRoomState]
    room-notice.ts            failureNotice(error) -> message      (bun test)
    room-status.svelte        "connecting" / closed card  (page 247-261)
    lobby.svelte              table + side column          (page 263-447)
    lobby-seat.svelte         was {#snippet seatSpot}      (page 162-208)
    lobby-settings.svelte     title, target score, invite, start, leave (316-416)
    target-score-picker.svelte                             (page 327-368)
    member-list.svelte                                     (page 418-439)
    room-menu.svelte, room-return.svelte                   (moved)
  match/
    match-log.ts              foldMatchView(prev, next) -> lastTrick, dealScore, deals (bun test)
    match-view.ts             playable, calls, sorted hand, shown trick, seat places (bun test)
    cards.ts                  (existing)
    match-screen.svelte       layout shell only: grid, wide/narrow switch
    match-seat.svelte         was {#snippet seat} + backs + figure  (screen 127-185)
    dealer-coaster.svelte     was {#snippet coaster}                 (screen 116-125)
    match-trick.svelte        trick on the cloth + "won by"          (screen 290-325)
    match-hand.svelte         turn badge + hand fan                  (screen 334-409)
    trump-call.svelte         call / pass buttons                    (screen 353-388)
    score-strip.svelte        phone score bar                        (screen 237-274)
    match-sidebar.svelte      was {#snippet sidebar}                 (screen 187-217)
    match-result.svelte       "match over" overlay                   (screen 437-478)
    deal-score-sheet.svelte   phone deal score sheet                 (screen 479-491)
    leave-match-dialog.svelte                                        (screen 219-232)
    match-pause.svelte        (moved)
    playing-card, suit-pip, deal-score, declarations, score-pad   (existing, props only)
  chat/
    chat-state.svelte.ts      messages, muted, send; subscribes to the room socket
    room-chat.svelte
  account/
    account.ts, claim-form, username-form, sign-out, kafana-letter
  shared/
    chair-figure.svelte       used by lobby and match
    players.ts, utils.ts
  components/ui/              shadcn output; keep here, or move and edit the
                              "ui" alias in components.json
routes/rooms/[id]/+page.svelte  ~30 lines: make RoomState, set context,
                                connect on id, pick status / lobby / match
```

`RoomState` shape, from the current page:

```ts
export class RoomState {
  room = $state.raw<RoomView | null>(null);
  match = $state.raw<MatchView | null>(null);
  log = $state.raw<MatchLog>(emptyLog);          // lastTrick, dealScore, deals
  notice = $state<string | null>(null);
  closedReason = $state<(() => string) | null>(null);
  socket = $state.raw<RoomSocket | null>(null);

  isOwner = $derived(...);
  mySeat = $derived(...);

  connect = (id: string) => { /* join, subscribe; return () => ws.close() */ };
  move = (move: BelotMove) => { ... };
  start = () => ...;  takeSeat = (seat: Seat) => ...;  leave = () => ...;
}
export const [getRoomState, setRoomState] = createContext<RoomState>();
```

`me` (TanStack query) has to be created in component init. Pass a getter
(`() => me.data?.id`) to the constructor so `isOwner` stays reactive.

`match-screen` then holds only layout and the `wide` media query. Its eleven
props go away: regions read `getRoomState()`, and the `chat` snippet prop can
stay so `match/` does not import `chat/`.

## 1. Folder layout

**Docs.** `src/lib` is for "library code (utilities and components)". In
`src/routes` "you can also colocate other components that are only used within
a single route" ([kit project structure](https://svelte.dev/docs/kit/project-structure)).
The docs do not prescribe feature folders or buckets.

**Practice. The sources disagree. Most mix three places:**

| Repo               | Shared components                                                                 | Feature / route code                                                                                                                       | State classes                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| svelte.dev         | `apps/svelte.dev/src/lib/components/` bucket                                      | Route-colocated: `src/routes/_home/Hero.svelte`, `routes/(authed)/playground/[...id]/AppControls.svelte`                                   | Route-colocated `routes/tutorial/[...slug]/adapter.svelte.ts`; package-level `packages/repl/src/lib/Workspace.svelte.ts` next to `Repl.svelte` |
| shadcn-svelte docs | `docs/src/lib/components/` bucket                                                 | `docs/src/lib/features/design-system/` (feature folder), and route-colocated `docs/src/routes/(app)/(layout)/(create)/components/*.svelte` | Next to the components that use them: `.../(create)/components/action-menu-context.svelte.ts`, `lib/registry/ui/sidebar/context.svelte.ts`     |
| bits-ui            | n/a (library)                                                                     | One folder per feature: `packages/bits-ui/src/lib/bits/tabs/` with `components/`, `tabs.svelte.ts`, `types.ts`, `index.ts`                 | Beside the components: `bits/tabs/tabs.svelte.ts`                                                                                              |
| immich web         | `web/src/lib/components/` with per-page subfolders (`asset-viewer/`, `timeline/`) | Same buckets                                                                                                                               | Grouped by kind, not feature: `web/src/lib/managers/*-manager.svelte.ts`, `web/src/lib/stores/*.svelte.ts`                                     |

Takeaway: the newest structure (bits-ui, shadcn `lib/features/`) puts state
next to the components that use it. That matches the repo decision. immich
groups by kind (`managers/`, `stores/`) and is the main counter-example.

Route colocation (svelte.dev `_home/`, sv demo `routes/sverdle/game.ts`, from
[sveltejs/cli](https://github.com/sveltejs/cli/tree/main/packages/sv/src/create/templates/demo/src/routes/sverdle))
fits code that only one route uses. Here the match screen and chat are shared
by room page states, so `lib/<feature>/` is the better fit.

## 2. When and how to split a large component

**Docs.** No official size rule. Relevant rules:

- Props down, callbacks up: "don't mutate props", "use callback props to
  communicate changes" ([$props](https://svelte.dev/docs/svelte/$props)).
- Snippets are "reusable chunks of markup inside your components"; they can be
  passed as props, "like passing content instead of data", and replace slots
  ([snippet](https://svelte.dev/docs/svelte/snippet)).
- Use context, not shared module state; prefer `createContext` to
  `setContext`/`getContext` for type safety
  ([best practices](https://svelte.dev/docs/svelte/best-practices),
  [context](https://svelte.dev/docs/svelte/context)). `createContext` returns
  `[get, set]`; added in 5.40.

**Practice.**

- _By region._ shadcn-svelte splits `docs/src/lib/components/block-viewer.svelte`
  into `block-viewer-toolbar`, `block-viewer-view`, `block-viewer-view-mobile`,
  `block-viewer-code`, and shares state by a context it declares in
  `<script module>`. Note the separate mobile component: the same answer for
  our `wide.current` branches.
- _Snippets for content handed to a child._ `packages/repl/src/lib/Repl.svelte`
  passes `{#snippet a()}` / `{#snippet b()}` into `SplitPane`. Our `chat`
  snippet into `MatchScreen` is the same use.
- _Context vs props._ bits-ui: the root calls `TabsRootState.create(...)`, which
  sets context; `TabsListState.create` reads it (`bits/tabs/tabs.svelte.ts`).
  svelte.dev's Repl does both: it puts `workspace` in context
  (`set_repl_context`, `packages/repl/src/lib/context.ts`) and also passes
  `{workspace}` as a prop to `Editor` and `ComponentSelector`. So the team does
  not use one rule. Context for the screen state, props for leaves, is the
  common middle.

**Rule of thumb for this repo** (my synthesis, not a source rule):

- Component: the region has its own derived values, its own local state, or
  you would want to read it alone.
- Snippet: under ~20 lines, no own state, used more than once in the file
  (`backs`, `figure`).
- Context: data that most regions of one screen need (room, match, actions).
- Props: everything below that, and anything reused across features.

## 3. Shape of a state class

**Docs** ([$state](https://svelte.dev/docs/svelte/$state)):

- Use `$state` in class fields, public or private, or as the first assignment
  in the constructor. Instances are not proxied.
- `this` is lost when you pass a method as a handler (`onclick={todo.reset}`).
  Fix: an inline arrow at the call site, or define the method as an arrow field.
- You cannot export state that you reassign from a `.svelte.ts` module; export
  an object or a class instead
  ([.svelte.js files](https://svelte.dev/docs/svelte/svelte-js-files)).
- Use `$state.raw` for large data that you replace, such as API responses;
  compute with `$derived`, not `$effect`
  ([best practices](https://svelte.dev/docs/svelte/best-practices)). Our
  `RoomView` and `MatchView` are replaced wholesale, so `$state.raw` fits.
- Effect teardown runs before re-run and when the owner is destroyed.
  `$effect.root` makes a scope that does not auto-clean, for effects outside
  component init ([$effect](https://svelte.dev/docs/svelte/$effect)).
- For an external event source, `createSubscriber` ties start/stop to the
  effects that read it ([svelte/reactivity](https://svelte.dev/docs/svelte/svelte-reactivity)).

**Practice:**

- `packages/repl/src/lib/Workspace.svelte.ts` (svelte.dev): private `#files =
$state.raw(...)` with public getters, `diagnostics = $derived.by(...)`,
  callbacks (`onupdate`, `onreset`) passed in the constructor, plain methods.
  `onhover(fn)` calls `$effect` inside a method, so the caller's component
  owns the cleanup.
- `packages/repl/src/lib/Bundler.svelte.ts`: uses `$effect.root` with an
  explicit `destroy()` for work outside component init.
- `docs/src/lib/registry/ui/sidebar/context.svelte.ts` (shadcn-svelte):
  `$state` and `$derived.by` fields, methods as arrow fields (`toggle = () =>`),
  `setSidebar`/`useSidebar` pair around `setContext`.
- `bits/tabs/tabs.svelte.ts` (bits-ui): `static create()` builds and sets
  context; `readonly props = $derived.by(...)`; `register*` methods return
  their own cleanup.
- `web/src/lib/managers/activity-manager.svelte.ts` (immich): private `$state`
  fields with getters; exported as a module singleton
  (`export const activityManager = new ActivityManager()`).

**Disagreements.** Singletons (immich) vs context (docs). The docs' reason is
SSR leaks between users. This app has `ssr = false`
(`apps/web/src/routes/+layout.ts`), so that risk is gone, but room state is
per room and per page, so an instance in context is still right. Plain methods
(svelte.dev, bits-ui) vs arrow fields (shadcn): we pass actions straight to
`onclick`, so use arrow fields.

**Lifecycle choice.** Two shapes appear: an `$effect` inside the class
(Workspace.onhover) or a method that returns teardown and is called from the
component's `$effect` (bits-ui `register*`). Use the second: `connect(id)`
returns `() => ws.close()`, and the page writes `$effect(() => room.connect(id))`.
It keeps the class usable outside a component and makes the id dependency
visible in the page.

## 4. Naming

- Svelte only requires the _tag_ to be capitalised: "A capitalised tag or a
  tag that uses dot notation ... indicates a component"
  ([basic markup](https://svelte.dev/docs/svelte/basic-markup)). File names
  are free.
- Svelte team code uses PascalCase files: `Repl.svelte`, `Workspace.svelte.ts`,
  `routes/_home/Hero.svelte`, sv demo `routes/Header.svelte`. immich uses
  PascalCase components and kebab-case managers.
- shadcn-svelte and bits-ui use kebab-case throughout (`tabs-trigger.svelte`,
  `block-viewer-toolbar.svelte`, `context.svelte.ts`). The repo rule matches
  them, and so does the shadcn output already in `lib/components/ui/`.
- Prefix region files with the parent name (`block-viewer-*`, `tabs-*`). Sorted
  file lists then show the tree.
- State files: `<thing>.svelte.ts` (bits-ui `tabs.svelte.ts`) or
  `<thing>-context.svelte.ts` / `<thing>-state.svelte.ts` (shadcn). Pick
  `<feature>-state.svelte.ts`.
- The `.svelte` in `.svelte.ts` is required to use runes in that file
  ([.svelte.js files](https://svelte.dev/docs/svelte/svelte-js-files)). Pure
  logic files stay `.ts`, so `bun test` runs them without the Svelte compiler.

## 5. Order inside a `.svelte` file

**Docs.** No ordering rule for script contents. The example on
[.svelte files](https://svelte.dev/docs/svelte/svelte-files) shows
`<script module>`, `<script>`, markup, `<style>`.

**Practice.** No strict order in svelte.dev: `Repl.svelte` mixes `$state`,
functions and `$derived` through the script. bits-ui components are steady:
imports, `$props.id()`, `$props()`, state `create`, `$derived`
(`bits/tabs/components/tabs.svelte`). shadcn's `block-viewer.svelte` puts
module-level types and context in `<script module>`.

**Proposed order** (synthesis of bits-ui and the docs):

1. `<script module>`: only if you export types or a snippet.
2. `<script>`: imports; `$props()` with an inline or `Props` type; context
   reads (`getRoomState()`); local `$state`; `$derived`; functions and
   handlers; `$effect` last.
3. Snippets, at the top of the markup, before the first element. This repo
   already does this.
4. Markup.
5. `<style>` (rare here; Tailwind).

## Repos reviewed

- **sveltejs/svelte.dev** ([GitHub](https://github.com/sveltejs/svelte.dev)).
  The Svelte site, by the Svelte team. `packages/repl` holds the playground:
  `Workspace.svelte.ts` and `Bundler.svelte.ts` state classes, `context.ts`,
  region folders `Input/`, `Output/`, `Editor/`. `apps/svelte.dev` colocates
  route components (`routes/_home/`, `routes/(authed)/playground/[...id]/`).
- **huntabyte/shadcn-svelte** ([GitHub](https://github.com/huntabyte/shadcn-svelte)).
  The docs site in `docs/`. Kebab-case files, region split with prefixes
  (`block-viewer-*`), `lib/features/design-system/`, route-colocated
  components with `*-context.svelte.ts`, sidebar state class in
  `lib/registry/ui/sidebar/context.svelte.ts`.
- **huntabyte/bits-ui** ([GitHub](https://github.com/huntabyte/bits-ui)).
  Headless component library behind shadcn-svelte. One folder per component in
  `packages/bits-ui/src/lib/bits/<name>/`; state classes with
  `static create()` and context.
- **sveltejs/cli** ([GitHub](https://github.com/sveltejs/cli)). The `sv create`
  demo template: `packages/sv/src/create/templates/demo/src/routes/sverdle/`
  colocates `game.ts` with the route; `routes/Header.svelte` PascalCase.
- **immich-app/immich** ([GitHub](https://github.com/immich-app/immich)).
  Large SvelteKit photo app. `web/src/lib/components/<page>/` buckets,
  `web/src/lib/managers/*-manager.svelte.ts` singleton classes, some with
  `.svelte.spec.ts` tests.
