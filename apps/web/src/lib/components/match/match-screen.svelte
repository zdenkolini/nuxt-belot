<script lang="ts">
  import type { Snippet } from 'svelte';
  import { flip } from 'svelte/animate';
  import { MediaQuery } from 'svelte/reactivity';
  import {
    teamOf,
    type BelotMove,
    type DealScore,
    type Seat,
    type Team,
    type TeamPoints,
    type Trick,
  } from '@belot/engine';
  import type { MatchView, RoomView } from '@belot/server';
  import { Button } from '#lib/components/ui/button';
  import * as Card from '#lib/components/ui/card';
  import * as Dialog from '#lib/components/ui/dialog';
  import { m } from '#lib/paraglide/messages';
  import {
    isRed,
    receive,
    send,
    sortHand,
    suitNames,
    sweep,
  } from '#lib/components/match/cards';
  import ChairFigure from '#lib/components/match/chair-figure.svelte';
  import DealScoreTable from '#lib/components/match/deal-score.svelte';
  import Declarations from '#lib/components/match/declarations.svelte';
  import PlayingCard from '#lib/components/match/playing-card.svelte';
  import ScorePad from '#lib/components/match/score-pad.svelte';
  import SuitPip from '#lib/components/match/suit-pip.svelte';

  let {
    match,
    room,
    lastTrick,
    dealScore,
    deals,
    isOwner,
    onmove,
    ondismissscore,
    onplayagain,
    onback,
    onleave,
    chat,
  }: {
    match: MatchView;
    room: RoomView;
    lastTrick: Trick | null;
    dealScore: DealScore | null;
    deals: TeamPoints[];
    isOwner: boolean;
    onmove: (move: BelotMove) => void;
    ondismissscore: () => void;
    onplayagain: () => void;
    onback: () => void;
    onleave: () => void;
    chat?: Snippet;
  } = $props();

  let confirmingLeave = $state(false);

  const wide = new MediaQuery('min-width: 48rem');
  let padOpen = $state(false);

  const view = $derived(match.view);
  const myTeam = $derived(teamOf(match.seat));
  const usernameOf = (seat: Seat) => match.players[seat]?.username ?? '';
  // Seats from my point of view: 0 me, 1 right, 2 top, 3 left.
  const at = (offset: number) => ((match.seat + offset) % 4) as Seat;
  const placeOf = (seat: Seat) => (seat - match.seat + 4) % 4;
  const places = [
    'col-start-2 row-start-3',
    'col-start-3 row-start-2',
    'col-start-2 row-start-1',
    'col-start-1 row-start-2',
  ];
  // Cards land a little askew, as thrown.
  const tilts = [-3, 5, 2, -6];

  const playable = $derived(
    new Set(
      match.legalMoves.flatMap((move) =>
        move.type === 'play' ? [move.card.id] : [],
      ),
    ),
  );
  const calls = $derived(
    match.legalMoves.filter((move) => move.type !== 'play'),
  );
  const canPass = $derived(calls.some((move) => move.type === 'pass'));
  const hand = $derived(sortHand(view.hand));
  const shownTrick = $derived(
    view.trick.length > 0 ? view.trick : (lastTrick?.plays ?? []),
  );
  const teamName = (team: Team) =>
    team === myTeam ? m.score_us() : m.score_them();
  const callerName = $derived(
    view.caller === null ? null : usernameOf(view.caller),
  );

  // Kept after the trick clears, so its cards still know where to slide.
  let sweepPlace = $state(0);
  $effect(() => {
    if (lastTrick) sweepPlace = placeOf(lastTrick.winner);
  });

  // The hand fans out on a shallow arc.
  const fan = (i: number) => {
    const offset = i - (hand.length - 1) / 2;
    return `rotate: ${offset * 3.5}deg; translate: 0 ${offset * offset * 0.07}rem`;
  };
</script>

{#snippet coaster()}
  <!-- A beer mat with the dealer's initial printed in the ring. -->
  <span
    class="grid size-7 shrink-0 -rotate-12 md:size-9 place-items-center rounded-full bg-(--coaster) font-hand text-base leading-none font-bold text-(--oxblood) md:text-xl shadow-[inset_0_0_0_3px_var(--coaster),inset_0_0_0_5px_var(--oxblood),inset_0_0_0_7px_var(--coaster),inset_0_0_0_8px_var(--oxblood),0_2px_5px_oklch(0.25_0.08_25/0.4)]"
    title={m.dealer()}
  >
    <span aria-hidden="true">{m.dealer().charAt(0)}</span>
    <span class="sr-only">{m.dealer()}</span>
  </span>
{/snippet}

{#snippet backs(count: number, size: string)}
  <div class="flex items-end pl-2.5" aria-hidden="true">
    {#each { length: count }, i (i)}
      <div
        class="card-back -ml-2.5 origin-bottom {size}"
        style:rotate="{(i - (count - 1) / 2) * 7}deg"
      ></div>
    {/each}
  </div>
{/snippet}

{#snippet figure(className: string)}
  <svg viewBox="0 0 100 90" class="figure {className}" aria-hidden="true">
    <circle cx="50" cy="28" r="17" />
    <path d="M8 90c2-26 18-40 42-40s40 14 42 40Z" />
  </svg>
{/snippet}

<!-- A player in a chair behind the table, holding their cards; or, where the
     phone has no room for a chair, a name card with a portrait. -->
{#snippet seat(seat: Seat, seated: boolean)}
  {@const count = view.cardCounts[seat] ?? 0}
  <div class="relative flex flex-col items-center">
    {#if seated}
      <ChairFigure
        >{@render backs(count, 'h-5 w-3.5 md:h-6 md:w-4')}</ChairFigure
      >
    {:else}
      {@render backs(count, 'mb-1.5 h-6 w-4')}
    {/if}
    <div
      class={[
        'paper relative z-3 mt-1.5 flex max-w-32 items-center gap-2 px-2.5 py-1.5 md:max-w-40 md:px-3 transition-[outline-color,translate] duration-300',
        match.turn === seat
          ? 'outline-3 outline-offset-2 outline-(--oxblood) -translate-y-0.5'
          : 'outline-3 outline-offset-2 outline-transparent',
      ]}
    >
      {#if !seated}
        <span
          class="grid size-7 shrink-0 place-items-end overflow-hidden rounded-full bg-(--wall)"
        >
          {@render figure('w-full translate-y-[8%]')}
        </span>
      {/if}
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold"
          >{usernameOf(seat)}</span
        >
        <span class="block text-xs whitespace-nowrap text-(--ink-soft)">
          {m.cards_in_hand({ count })}
        </span>
      </span>
      {#if view.dealer === seat}
        <span class="absolute -top-3 -right-3">{@render coaster()}</span>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet sidebar()}
  <ScorePad
    target={room.targetScore}
    scores={view.scores}
    {deals}
    {myTeam}
    trump={view.trump}
    {callerName}
  >
    <Declarations {view} {usernameOf} {myTeam} />
    {#if dealScore}
      <section class="flex flex-col gap-2 border-t border-(--border) pt-3">
        <h2 class="text-sm font-semibold">{m.deal_score()}</h2>
        <DealScoreTable score={dealScore} {myTeam} />
      </section>
    {/if}
  </ScorePad>
  {#if chat}
    <div class="paper rotate-[0.6deg] px-4 py-3 text-sm">{@render chat()}</div>
  {/if}
  {#if !match.result && !match.ended}
    <Button
      variant="outline"
      size="sm"
      class="self-start"
      onclick={() => (confirmingLeave = true)}
    >
      {m.leave_match()}
    </Button>
  {/if}
{/snippet}

<Dialog.Root bind:open={confirmingLeave}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{m.leave_match_title()}</Dialog.Title>
      <Dialog.Description>{m.leave_match_description()}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (confirmingLeave = false)}
        >{m.stay_in_match()}</Button
      >
      <Button variant="destructive" onclick={onleave}>{m.leave_match()}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<div
  class="table-skin room grid h-svh grid-rows-[auto_1fr] overflow-hidden text-(--ink) md:grid-cols-[1fr_19rem] md:grid-rows-1"
>
  {#if !wide.current}
    <div class="flex flex-col gap-2 px-3 pt-3">
      <button
        type="button"
        class="paper flex items-center gap-3 px-3 py-1.5 text-left"
        aria-label={m.open_score_pad()}
        onclick={() => (padOpen = true)}
      >
        {#if view.trump}
          <SuitPip
            suit={view.trump}
            class="size-6 shrink-0 {isRed(view.trump)
              ? 'text-(--card-red)'
              : 'text-(--card-black)'}"
          />
          <span class="sr-only">{suitNames[view.trump]()}</span>
        {:else}
          <span
            class="size-6 shrink-0 rounded-full border-2 border-dashed border-(--ink-soft)"
          ></span>
        {/if}
        <span
          class="flex flex-1 items-baseline gap-4 font-hand text-2xl leading-none tabular-nums"
        >
          <span>{m.score_us()} <b>{view.scores[myTeam]}</b></span>
          <span>{m.score_them()} <b>{view.scores[1 - myTeam]}</b></span>
        </span>
        <span class="text-xs text-(--ink-soft)"
          >{m.totals_to({ target: room.targetScore })}</span
        >
      </button>
      {#if view.declarations.length > 0 || view.belote !== null}
        <div class="paper px-3 py-2 text-sm">
          <Declarations {view} {usernameOf} {myTeam} />
        </div>
      {/if}
    </div>
  {/if}

  <main
    class="grid min-h-0 grid-rows-[1fr_auto] items-center justify-items-center gap-2 px-3 pt-6 pb-2 [--card-w:clamp(2.9rem,12vw,5.5rem)] [--seat-w:3.5rem] [--tilt:22deg] md:px-6 md:pt-10 md:[--card-w:clamp(4rem,min(7.5vw,12svh),7rem)] md:[--seat-w:clamp(4.5rem,7vw,6.5rem)] md:[--tilt:34deg]"
  >
    <div class="flex w-full flex-col items-center self-center">
      <div class="relative -mb-2 md:-mb-[calc(var(--seat-w)*0.5)]">
        {@render seat(at(2), true)}
      </div>

      <div class="grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center">
        <div
          class="relative z-3 col-start-1 row-start-1 self-center justify-self-start md:z-auto md:-mr-6 md:justify-self-end"
        >
          {@render seat(at(3), wide.current)}
        </div>
        <section
          class="relative z-1 col-span-3 col-start-1 row-start-1 flex flex-col items-center gap-4 perspective-[900px] md:col-span-1 md:col-start-2"
          aria-label={m.trick()}
        >
          <div
            class="cloth tabletop grid place-items-center px-[calc(var(--card-w)*0.9)] py-[calc(var(--card-w)*0.45)] max-md:px-[calc(var(--card-w)*1.5)] max-md:py-[calc(var(--card-w)*0.9)]"
          >
            <div
              class="grid grid-cols-[repeat(3,calc(var(--card-w)*0.9))] grid-rows-[repeat(3,calc(var(--card-w)*0.8))] place-items-center"
            >
              {#each shownTrick as play (play.card.id)}
                <div
                  class="{places[placeOf(play.seat)]} z-1"
                  animate:flip={{ duration: 300 }}
                  in:receive={{ key: play.card.id }}
                  out:sweep={{ place: sweepPlace }}
                >
                  <div style:rotate="{tilts[placeOf(play.seat)]}deg">
                    <PlayingCard
                      card={play.card}
                      won={view.trick.length === 0 &&
                        lastTrick?.winner === play.seat}
                    />
                  </div>
                </div>
              {/each}
            </div>
          </div>
          <p class="min-h-7" role="status">
            {#if view.trick.length === 0 && lastTrick}
              <span class="paper inline-block px-2.5 py-1 text-xs font-medium">
                {m.trick_won_by({ username: usernameOf(lastTrick.winner) })}
              </span>
            {/if}
          </p>
        </section>
        <div
          class="relative z-3 col-start-3 row-start-1 self-center justify-self-end md:z-auto md:-ml-6 md:justify-self-start"
        >
          {@render seat(at(1), wide.current)}
        </div>
      </div>
    </div>

    <section
      class="flex w-full flex-col items-center gap-3 max-md:[--card-w:clamp(3.4rem,16.5vw,5.5rem)]"
      aria-label={m.your_hand()}
    >
      <div class="flex items-center gap-2" role="status">
        {#if match.turn === match.seat}
          <span
            class="rounded-[2px] bg-(--oxblood) px-3 py-1 text-sm font-semibold text-(--card-face) shadow-[0_6px_14px_-6px_oklch(0.25_0.08_25/0.6)]"
          >
            {m.your_turn()}
          </span>
        {:else if match.turn !== null}
          <span class="paper px-3 py-1 text-sm"
            >{m.turn_of({ username: usernameOf(match.turn) })}</span
          >
        {/if}
        {#if view.dealer === match.seat}{@render coaster()}{/if}
      </div>

      {#if calls.length > 0}
        <div class="paper flex flex-col items-center gap-3 px-4 py-3">
          <p class="text-center text-sm font-medium">
            {canPass ? m.call_trump() : m.must_call()}
          </p>
          <div class="flex flex-wrap justify-center gap-2">
            {#each calls as move (move.type === 'call' ? move.suit : 'pass')}
              {#if move.type === 'call'}
                <button
                  type="button"
                  class="flex w-16 flex-col items-center gap-1 rounded-[3px] border border-(--border) bg-(--card-face) px-2 pt-2 pb-1.5 shadow-[0_1px_2px_oklch(0.25_0.08_25/0.2)] transition-[translate,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_12px_-4px_oklch(0.25_0.08_25/0.45)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--oxblood) active:translate-y-0"
                  onclick={() => onmove(move)}
                >
                  <SuitPip
                    suit={move.suit}
                    class="size-7 {isRed(move.suit)
                      ? 'text-(--card-red)'
                      : 'text-(--card-black)'}"
                  />
                  <span class="text-xs font-medium"
                    >{suitNames[move.suit]()}</span
                  >
                </button>
              {:else}
                <Button
                  variant="outline"
                  class="h-auto min-h-10 self-stretch px-5"
                  onclick={() => onmove(move)}
                >
                  {m.pass()}
                </Button>
              {/if}
            {/each}
          </div>
        </div>
      {/if}

      <div class="flex justify-center pt-3 pb-[calc(var(--card-w)*0.4)]">
        {#each hand as card, i (card.id)}
          <div
            class="-ml-[calc(var(--card-w)*0.45)] first:ml-0 md:-ml-[calc(var(--card-w)*0.18)] md:first:ml-0"
            animate:flip={{ duration: 300 }}
            in:receive={{ key: card.id }}
            out:send={{ key: card.id }}
          >
            <div class="origin-bottom" style={fan(i)}>
              <PlayingCard
                {card}
                playable={playable.has(card.id)}
                dimmed={playable.size > 0 && !playable.has(card.id)}
                onclick={() => onmove({ type: 'play', card })}
              />
            </div>
          </div>
        {/each}
      </div>
    </section>
  </main>

  {#if wide.current}
    <aside class="flex min-h-0 flex-col gap-5 overflow-y-auto py-6 pr-6 pl-2">
      <div class="-rotate-[0.8deg]">{@render sidebar()}</div>
    </aside>
  {:else}
    <Dialog.Root bind:open={padOpen}>
      <Dialog.Content
        class="max-h-[85svh] gap-4 overflow-y-auto bg-transparent p-0 ring-0"
        onOpenAutoFocus={(event) => {
          // Not the chat input: that would open the phone keyboard.
          event.preventDefault();
          document
            .querySelector<HTMLElement>('[data-slot=dialog-close]')
            ?.focus();
        }}
      >
        <Dialog.Title class="sr-only"
          >{m.totals_to({ target: room.targetScore })}</Dialog.Title
        >
        {@render sidebar()}
      </Dialog.Content>
    </Dialog.Root>
  {/if}
</div>

{#if match.result}
  <div
    class="table-skin fixed inset-0 z-10 flex items-center justify-center bg-[oklch(0.2_0.06_25/0.45)] p-4"
  >
    <Card.Root class="paper w-full max-w-sm rounded-[2px] ring-0">
      <Card.Header>
        <Card.Title class="font-hand text-4xl leading-none"
          >{m.match_over()}</Card.Title
        >
        <Card.Description
          >{m.team_won({ number: match.result.winner + 1 })}</Card.Description
        >
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <ul class="flex flex-col font-hand text-2xl tabular-nums">
          {#each [0, 1] as const as team (team)}
            <li
              class={[
                'flex justify-between',
                team === match.result.winner && 'font-bold',
              ]}
            >
              <span>{teamName(team)}</span>
              <span>{match.result.scores[team]}</span>
            </li>
          {/each}
        </ul>
        {#if dealScore}
          <DealScoreTable score={dealScore} {myTeam} />
        {/if}
        {#if !isOwner}
          <p class="text-sm text-(--ink-soft)">{m.wait_for_owner()}</p>
        {/if}
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onclick={onback}>{m.back_to_room()}</Button>
          {#if isOwner}
            <Button onclick={onplayagain}>{m.play_again()}</Button>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  </div>
{:else if dealScore && !wide.current}
  <div class="table-skin fixed inset-x-0 bottom-0 z-10 p-3">
    <Card.Root class="paper rounded-[2px] ring-0">
      <Card.Header>
        <Card.Title>{m.deal_score()}</Card.Title>
      </Card.Header>
      <Card.Content class="flex flex-col gap-3">
        <DealScoreTable score={dealScore} {myTeam} />
        <Button onclick={ondismissscore}>{m.continue()}</Button>
      </Card.Content>
    </Card.Root>
  </div>
{/if}
