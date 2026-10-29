<script lang="ts">
  import type { DealScore, Team, TeamPoints } from '@belot/engine';
  import { m } from '#lib/paraglide/messages';

  let { score, myTeam }: { score: DealScore; myTeam: Team } = $props();

  const rows: [() => string, TeamPoints][] = $derived([
    [m.card_points, score.cards],
    [m.last_trick, score.lastTrick],
    [m.sweep, score.sweep],
    [m.declarations, score.declarations],
    [m.belote, score.belote],
  ]);
  const teamName = (team: Team) =>
    team === myTeam ? m.score_us() : m.score_them();
  // On a failed contract the other team takes all points of the deal.
  const takesAll = $derived(score.points[0] > 0 ? 0 : 1);
</script>

<table class="w-full text-sm tabular-nums">
  <thead>
    <tr class="text-muted-foreground">
      <th class="text-left font-normal"></th>
      <th class="text-right font-normal">{teamName(0)}</th>
      <th class="text-right font-normal">{teamName(1)}</th>
    </tr>
  </thead>
  <tbody>
    {#each rows as [label, points] (label)}
      <tr>
        <td>{label()}</td>
        <td class="text-right">{points[0]}</td>
        <td class="text-right">{points[1]}</td>
      </tr>
    {/each}
    <tr class="border-t font-semibold">
      <td>{m.deal_points()}</td>
      <td class="text-right">{score.points[0]}</td>
      <td class="text-right">{score.points[1]}</td>
    </tr>
  </tbody>
</table>
{#if score.failed}
  <p class="mt-2 text-sm text-destructive">
    {m.failed_contract({ number: takesAll + 1 })}
  </p>
{/if}
