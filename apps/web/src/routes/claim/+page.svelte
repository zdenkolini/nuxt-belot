<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { api } from '#lib/api.js';
	import { claimQuery, meQuery, queryClient } from '#lib/account.js';
	import Variants from '#lib/components/account-prototype/variants.svelte';
	import type { Choice } from '#lib/components/account-prototype/types.js';
	import { m } from '#lib/paraglide/messages.js';

	const me = createQuery(() => meQuery);
	const claim = createQuery(() => claimQuery);
	let choosing = $state(false);
	let chooseFailed = $state(false);

	// PROTOTYPE: ?demo shows made-up counts when no claim waits.
	const shown = $derived(
		claim.data ??
			(page.url.searchParams.has('demo') ? { accountMatches: 12, guestMatches: 3 } : null),
	);

	const choose = async (choice: Choice) => {
		choosing = true;
		const { error } = await api.me.claim.post({ choice });
		choosing = false;
		chooseFailed = !!error;
		if (!error) await queryClient.invalidateQueries({ queryKey: claimQuery.queryKey });
	};
</script>

<svelte:head>
	<title>{m.claim_choice_title()} · {m.app_title()}</title>
</svelte:head>

<Variants
	screen="claim"
	demoLabel="demo claim"
	me={me.data ?? null}
	matches={null}
	claim={shown}
	{choosing}
	{chooseFailed}
	onchoose={choose}
/>
