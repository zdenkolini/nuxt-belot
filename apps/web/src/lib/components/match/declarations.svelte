<script lang="ts">
  import type { BelotView, Declaration, Seat, Team } from '@belot/engine';
  import { m } from '#lib/paraglide/messages.js';
  import { isRed, rankNames } from './cards.js';
  import SuitPip from './suit-pip.svelte';

  let {
    view,
    usernameOf,
    myTeam,
  }: {
    view: BelotView;
    usernameOf: (seat: Seat) => string;
    myTeam: Team;
  } = $props();

  const kindName = (declaration: Declaration) =>
    declaration.kind === 'sequence'
      ? m.sequence_of({ count: declaration.cards.length })
      : declaration.kind === 'fourOfAKind'
        ? m.four_of_a_kind()
        : m.full_sequence();
  const scoring = $derived(
    ([0, 1] as const).find((team) => view.declarationPoints[team] > 0),
  );
</script>

<div class="w-full" aria-live="polite">
  {#if view.declarations.length > 0 || view.belote !== null}
    <section class="flex w-full flex-col gap-1" aria-label={m.declarations()}>
      <h2 class="text-xs text-muted-foreground">{m.declarations()}</h2>
      <ul class="flex flex-col gap-1">
        {#each view.declarations as declaration (`${declaration.kind}-${declaration.cards[0]!.id}`)}
          <li class="flex flex-col">
            <span>
              {m.declaration_by({
                username: usernameOf(declaration.seat),
                kind: kindName(declaration),
                points: declaration.points,
              })}
            </span>
            <span class="flex gap-2 text-xs" aria-hidden="true">
              {#each declaration.cards as card (card.id)}
                <span
                  class="flex items-center {isRed(card.suit)
                    ? 'text-(--card-red)'
                    : 'text-(--card-black)'}"
                >
                  {rankNames[card.rank]()}<SuitPip
                    suit={card.suit}
                    class="size-3"
                  />
                </span>
              {/each}
            </span>
          </li>
        {/each}
        {#if view.belote !== null}
          <li>{m.belote_by({ username: usernameOf(view.belote) })}</li>
        {/if}
      </ul>
      {#if scoring !== undefined}
        <p class="text-sm text-(--ink-soft)">
          {(scoring === myTeam
            ? m.declarations_score_us
            : m.declarations_score_them)({
            points: view.declarationPoints[scoring],
          })}
        </p>
      {/if}
    </section>
  {/if}
</div>
