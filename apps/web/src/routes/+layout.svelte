<script lang="ts">
	import './layout.css';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { QueryClientProvider, createQuery } from '@tanstack/svelte-query';
	import favicon from '#lib/assets/favicon.svg';
	import { claimQuery, meQuery, queryClient } from '#lib/account.js';
	import RoomReturn from '#lib/components/room-return.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const me = createQuery(
		() => meQuery,
		() => queryClient,
	);

	const claim = createQuery(
		() => ({ ...claimQuery, enabled: !!me.data?.username && !me.data.isGuest }),
		() => queryClient,
	);

	afterNavigate(() => queryClient.invalidateQueries({ queryKey: ['me'], exact: true }));

	// Signed-out players may only sign in; new players must pick a username
	// first; a claim into an existing account waits for the player's choice.
	const target = $derived.by(() => {
		if (me.isPending || me.isError) return null;
		if (!me.data) return '/sign-in';
		if (me.data.username === null) return '/username';
		if (claim.data) return '/claim';
		const path = page.url.pathname;
		return path === '/sign-in' || path === '/username' || (path === '/claim' && claim.isSuccess)
			? '/'
			: null;
	});

	// An invite link opened before sign-in is kept, so the player lands in the
	// room once signed in. localStorage, because the magic link opens a new tab.
	$effect(() => {
		const path = page.url.pathname;
		if (target === '/sign-in' && path.startsWith('/rooms/')) {
			localStorage.setItem('returnTo', path);
		}
		const returnTo = localStorage.getItem('returnTo');
		if (!target && me.data?.username && returnTo) {
			localStorage.removeItem('returnTo');
			if (returnTo !== path) return void goto(returnTo);
		}
		if (target && target !== path) goto(target);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<QueryClientProvider client={queryClient}>
	{#if !me.isPending && (!target || target === page.url.pathname)}
		{@render children()}
		{#if me.data?.username}<RoomReturn />{/if}
	{/if}
</QueryClientProvider>
