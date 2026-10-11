<script lang="ts">
	// PROTOTYPE: picks the account, username, and claim design by ?variant=.
	import { page } from '$app/state';
	import PrototypeSwitcher from '#lib/components/prototype-switcher.svelte';
	import Bill from './bill.svelte';
	import Letter from './letter.svelte';
	import Namecard from './namecard.svelte';
	import type { VariantProps } from './types';

	let { demoLabel, ...props }: VariantProps & { demoLabel: string } = $props();

	const variants = [
		{ key: 'bill', name: "Waiter's bill" },
		{ key: 'namecard', name: 'Name card' },
		{ key: 'letter', name: 'Letter from the kafana' },
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'bill');
</script>

<PrototypeSwitcher {variants} {demoLabel} />
{#if variant === 'namecard'}
	<Namecard {...props} />
{:else if variant === 'letter'}
	<Letter {...props} />
{:else}
	<Bill {...props} />
{/if}
