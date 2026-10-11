<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { meQuery } from '#lib/account.js';
	import { api } from '#lib/api.js';
	import Variants from '#lib/components/account-prototype/variants.svelte';
	import { m } from '#lib/paraglide/messages.js';

	const me = createQuery(() => meQuery);
	const matches = createQuery(() => ({
		queryKey: ['me', 'matches'],
		queryFn: async () => {
			const { data, error } = await api.me.matches.get();
			if (error) throw error;
			return data;
		},
	}));

	// PROTOTYPE: ?demo shows the page as a guest sees it.
	const shown = $derived(
		me.data && page.url.searchParams.has('demo')
			? { ...me.data, username: 'guest_x7k2p9', isGuest: true }
			: (me.data ?? null),
	);
</script>

<svelte:head>
	<title>{m.account_title()} · {m.app_title()}</title>
</svelte:head>

<Variants
	screen="account"
	demoLabel="demo guest"
	me={shown}
	matches={matches.data?.length ?? null}
	claim={null}
	choosing={false}
	chooseFailed={false}
	onchoose={() => {}}
/>
