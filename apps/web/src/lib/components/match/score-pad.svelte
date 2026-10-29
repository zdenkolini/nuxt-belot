<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Suit, Team, TeamPoints } from '@belot/engine';
  import { m } from '#lib/paraglide/messages.js';
  import { isRed, suitNames } from './cards.js';
  import SuitPip from './suit-pip.svelte';

  let {
    target,
    scores,
    deals,
    myTeam,
    trump,
    callerName,
    children,
  }: {
    target: number;
    scores: TeamPoints;
    // Deals scored while this page was open; the rest is carried over.
    deals: TeamPoints[];
    myTeam: Team;
    trump: Suit | null;
    callerName: string | null;
    children?: Snippet;
  } = $props();

  const them = $derived((1 - myTeam) as Team);
  const carried = $derived(
    ([0, 1] as const).map(
      (team) => scores[team] - deals.reduce((sum, deal) => sum + deal[team], 0),
    ),
  );
  const hasCarried = $derived(
    deals.length > 0 && carried.some((points) => points !== 0),
  );
  const rows = $derived(hasCarried ? [carried as TeamPoints, ...deals] : deals);
</script>

<div class="paper flex flex-col gap-3 px-4 pt-3 pb-4">
  <p class="flex items-center gap-2 text-sm">
    {#if trump && callerName}
      <SuitPip
        suit={trump}
        class="size-6 shrink-0 {isRed(trump)
          ? 'text-(--card-red)'
          : 'text-(--card-black)'}"
      />
      {m.trump_called_by({ suit: suitNames[trump](), username: callerName })}
    {:else}
      <span
        class="size-6 shrink-0 rounded-full border-2 border-dashed border-(--ink-soft)"
      ></span>
      {m.calling_trump()}
    {/if}
  </p>

  <!-- Ruled like a pad: a line under every row, one ink rule between the columns. -->
  <table
    class="w-full font-hand text-2xl leading-[1.75rem] tabular-nums"
    aria-label={m.totals_to({ target })}
  >
    <caption
      class="caption-bottom pt-2 text-left font-sans text-xs leading-normal text-(--ink-soft)"
    >
      {m.totals_to({ target })}
    </caption>
    <thead>
      <tr class="border-b border-(--paper-rule) font-semibold">
        <th class="w-1/2 pr-3 text-right shadow-[inset_-2px_0_var(--ink)]"
          >{m.score_us()}</th
        >
        <th class="w-1/2 pl-3 text-right">{m.score_them()}</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i (i)}
        <tr
          class={[
            'border-b border-(--paper-rule)',
            i === 0 && hasCarried && 'text-(--ink-soft)',
          ]}
        >
          <td class="pr-3 text-right shadow-[inset_-2px_0_var(--ink)]"
            >{row[myTeam]}</td
          >
          <td class="pl-3 text-right">{row[them]}</td>
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr
        class="border-t-[5px] border-double border-(--ink) text-3xl leading-[2.5rem] font-bold"
      >
        <td class="pr-3 text-right shadow-[inset_-2px_0_var(--ink)]"
          >{scores[myTeam]}</td
        >
        <td class="pl-3 text-right">{scores[them]}</td>
      </tr>
    </tfoot>
  </table>

  {@render children?.()}
</div>
