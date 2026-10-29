<script lang="ts">
	import type { Snippet } from 'svelte';

	// A chair behind the table, sized by --seat-w; a player's silhouette sits in
	// it when occupied. `children` is what the player holds, such as their cards.
	let { occupied = true, children }: { occupied?: boolean; children?: Snippet } = $props();
</script>

<div class="relative aspect-[10/9] w-(--seat-w)" aria-hidden="true">
	<div class="chair absolute -inset-x-[4%] -top-[22%] bottom-[12%]"></div>
	{#if occupied}
		<svg viewBox="0 0 100 90" class="figure relative w-full">
			<circle cx="50" cy="28" r="17" />
			<path d="M8 90c2-26 18-40 42-40s40 14 42 40Z" />
		</svg>
	{/if}
	{#if children}
		<div class="absolute -bottom-[6%] left-1/2 -translate-x-1/2">{@render children()}</div>
	{/if}
</div>
