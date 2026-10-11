<script lang="ts">
	// PROTOTYPE: flips between UI variants via ?variant=. Throw away with the variants.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let { variants }: { variants: { key: string; name: string }[] } = $props();

	const current = $derived(page.url.searchParams.get('variant') ?? variants[0].key);
	const index = $derived(Math.max(0, variants.findIndex((v) => v.key === current)));
	const demo = $derived(page.url.searchParams.has('demo'));

	const go = (params: (p: URLSearchParams) => void) => {
		const url = new URL(page.url.href);
		params(url.searchParams);
		goto(url, { replaceState: true });
	};
	const step = (by: number) =>
		go((p) => p.set('variant', variants[(index + by + variants.length) % variants.length].key));

	const onkeydown = (e: KeyboardEvent) => {
		const el = e.target as HTMLElement;
		if (el.closest('input, textarea, [contenteditable]')) return;
		if (e.key === 'ArrowLeft') step(-1);
		if (e.key === 'ArrowRight') step(1);
	};
</script>

<svelte:window {onkeydown} />

{#if import.meta.env.DEV}
	<div
		class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/85 px-2 py-1.5 font-mono text-xs text-white shadow-lg"
	>
		<button class="rounded-full p-1 hover:bg-white/15" onclick={() => step(-1)} aria-label="Previous variant">
			<ChevronLeft class="size-4" />
		</button>
		<span class="min-w-40 text-center">{variants[index].key} ({variants[index].name})</span>
		<button class="rounded-full p-1 hover:bg-white/15" onclick={() => step(1)} aria-label="Next variant">
			<ChevronRight class="size-4" />
		</button>
		<button
			class={['ml-1 rounded-full px-2 py-0.5', demo ? 'bg-white text-black' : 'hover:bg-white/15']}
			onclick={() => go((p) => (demo ? p.delete('demo') : p.set('demo', '')))}
		>
			demo rooms
		</button>
	</div>
{/if}
