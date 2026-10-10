<script lang="ts">
	import type { Card } from '@belot/engine';
	import { cardName, isRed, rankNames, suitSymbols } from './cards.js';

	let {
		card,
		onclick,
		playable = false,
	}: { card: Card; onclick?: () => void; playable?: boolean } = $props();
</script>

{#snippet face()}
	<span class="text-sm leading-none font-semibold sm:text-base">{rankNames[card.rank]()}</span>
	<span class="text-xl leading-none sm:text-2xl" aria-hidden="true">{suitSymbols[card.suit]}</span>
{/snippet}

{#if onclick}
	<button
		type="button"
		class={[
			'flex h-20 w-14 flex-col items-center justify-center gap-1 rounded-md border bg-white shadow-sm transition sm:h-24 sm:w-16',
			isRed(card.suit) ? 'text-red-600' : 'text-neutral-900',
			playable ? 'cursor-pointer hover:-translate-y-2 hover:shadow-md' : 'opacity-50',
		]}
		disabled={!playable}
		aria-label={cardName(card)}
		{onclick}
	>
		{@render face()}
	</button>
{:else}
	<div
		class={[
			'flex h-20 w-14 flex-col items-center justify-center gap-1 rounded-md border bg-white shadow-sm sm:h-24 sm:w-16',
			isRed(card.suit) ? 'text-red-600' : 'text-neutral-900',
		]}
		role="img"
		aria-label={cardName(card)}
	>
		{@render face()}
	</div>
{/if}
