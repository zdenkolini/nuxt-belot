<script lang="ts">
  import type { Card } from '@belot/engine';
  import { cardName, isRed, rankNames } from '#lib/components/match/cards';
  import SuitPip from '#lib/components/match/suit-pip.svelte';

  let {
    card,
    onclick,
    playable = false,
    dimmed = false,
    won = false,
  }: {
    card: Card;
    onclick?: () => void;
    playable?: boolean;
    dimmed?: boolean;
    won?: boolean;
  } = $props();

  // Sized by the parent through --card-w; everything inside scales with the card.
  const classes = $derived([
    '@container relative block aspect-[5/7] w-(--card-w) rounded-[6%/4.3%] bg-(--card-face) shadow-[0_1px_1px_oklch(0.25_0.08_25/0.25),0_6px_14px_-4px_oklch(0.25_0.08_25/0.5)] select-none',
    isRed(card.suit) ? 'text-(--card-red)' : 'text-(--card-black)',
    won && 'outline-3 outline-offset-2 outline-(--oxblood)',
  ]);
</script>

{#snippet face()}
  {#each ['top-[5%] left-[7%]', 'right-[7%] bottom-[5%] rotate-180'] as corner (corner)}
    <span
      class="absolute flex flex-col items-center {corner}"
      aria-hidden="true"
    >
      <span class="text-[27cqw] leading-none font-bold tracking-[-0.04em]">
        {rankNames[card.rank]()}
      </span>
      <SuitPip suit={card.suit} class="mt-[3cqw] size-[17cqw]" />
    </span>
  {/each}
  <SuitPip suit={card.suit} class="absolute inset-0 m-auto size-[44cqw]" />
{/snippet}

{#if onclick}
  <button
    type="button"
    class={[
      classes,
      'transition-[translate,filter,box-shadow] duration-200 ease-out focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--oxblood)',
      playable &&
        'cursor-pointer hover:-translate-y-[18%] hover:shadow-[0_2px_2px_oklch(0.25_0.08_25/0.25),0_16px_24px_-6px_oklch(0.25_0.08_25/0.55)] focus-visible:-translate-y-[18%]',
      dimmed && 'translate-y-[8%] brightness-[0.9] saturate-[0.4]',
    ]}
    disabled={!playable}
    aria-label={cardName(card)}
    {onclick}
  >
    {@render face()}
  </button>
{:else}
  <div class={classes} role="img" aria-label={cardName(card)}>
    {@render face()}
  </div>
{/if}
