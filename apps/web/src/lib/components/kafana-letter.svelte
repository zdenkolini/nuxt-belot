<script lang="ts">
  import type { Snippet } from 'svelte';
  import Scissors from '@lucide/svelte/icons/scissors';
  import SuitPip from '#lib/components/match/suit-pip.svelte';
  import { m } from '#lib/paraglide/messages.js';

  // A letter from the kafana on its letterhead, signed by the house. The
  // reply, if any, is a slip below a dashed cut line.
  let {
    greeting,
    tilt = -0.8,
    children,
    reply,
  }: {
    greeting: string;
    tilt?: number;
    children: Snippet;
    reply?: Snippet;
  } = $props();
</script>

<article class="paper w-full max-w-md px-7 py-6" style:rotate="{tilt}deg">
  <header
    class="flex items-center justify-between border-b-2 border-(--ink) pb-2"
  >
    <span class="font-hand text-3xl leading-none font-bold"
      >{m.app_title()}</span
    >
    <span class="flex gap-1.5" aria-hidden="true">
      {#each ['spades', 'hearts', 'clubs', 'diamonds'] as const as suit (suit)}
        <SuitPip
          {suit}
          class="size-3.5 {suit === 'hearts' || suit === 'diamonds'
            ? 'text-(--card-red)'
            : 'text-(--card-black)'}"
        />
      {/each}
    </span>
  </header>
  <p class="mt-5 font-hand text-3xl leading-none">{greeting}</p>
  <div class="mt-3 text-sm leading-relaxed">{@render children()}</div>
  <p class="mt-3 text-right font-hand text-2xl leading-none">
    {m.letter_sign_off()}
  </p>
  {#if reply}
    <div
      class="relative my-5 border-t-2 border-dashed border-(--ink-soft)/50"
      aria-hidden="true"
    >
      <Scissors
        class="absolute -top-2.5 left-4 size-4 bg-(--paper) px-0.5 text-(--ink-soft)"
      />
    </div>
    {@render reply()}
  {/if}
</article>
