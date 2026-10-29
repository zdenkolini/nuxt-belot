<script lang="ts">
  import type { Suit } from '@belot/engine';

  let { suit, class: className }: { suit: Suit; class?: string } = $props();
</script>

<svg
  viewBox="0 0 100 100"
  class={className}
  fill="currentColor"
  aria-hidden="true"
>
  {#if suit === 'hearts'}
    <path
      d="M50 92C22 70 4 50 4 30 4 14 16 4 29 4c10 0 17 6 21 14 4-8 11-14 21-14 13 0 25 10 25 26 0 20-18 40-46 62Z"
    />
  {:else if suit === 'diamonds'}
    <path d="M50 2 88 50 50 98 12 50Z" />
  {:else if suit === 'spades'}
    <path
      d="M50 2C62 22 96 40 96 62c0 14-11 22-23 22-9 0-16-5-19-11 1 11 5 18 13 24H33c8-6 12-13 13-24-3 6-10 11-19 11-12 0-23-8-23-22C4 40 38 22 50 2Z"
    />
  {:else}
    <circle cx="50" cy="27" r="21" />
    <circle cx="26" cy="60" r="21" />
    <circle cx="74" cy="60" r="21" />
    <path d="M44 50h12v8c0 18 4 29 13 39H31c9-10 13-21 13-39Z" />
  {/if}
</svg>
