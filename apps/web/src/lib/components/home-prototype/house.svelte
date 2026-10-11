<script lang="ts">
	// PROTOTYPE variant "house": a small folded house menu is home. Public rooms
	// opens the full menu of rooms beside it (over it on a phone).
	import { resolve } from '$app/paths';
	import type { PublicRoom } from '@belot/server';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { Button } from '#lib/components/ui/button/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import MenuList from './menu-list.svelte';

	let {
		rooms,
		loaded,
		username,
		creating,
		oncreate,
	}: {
		rooms: PublicRoom[];
		loaded: boolean;
		username: string | null;
		creating: boolean;
		oncreate: () => void;
	} = $props();

	let open = $state(false);
</script>

<main class="table-skin room min-h-svh px-3 py-8 pb-20 text-(--ink) md:px-8 md:py-14">
	<div class="mx-auto flex max-w-5xl flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
		<nav
			class={[
				'paper w-full max-w-72 -rotate-[1deg] flex-col px-5 pt-5 pb-4 md:flex',
				open ? 'hidden' : 'flex',
				'bg-[linear-gradient(transparent_49.5%,oklch(0.25_0.08_25/0.07)_50%,transparent_50.5%)]',
			]}
		>
			<span class="font-hand text-5xl leading-none font-bold">{m.app_title()}</span>
			{#if username}
				<span class="mt-1 text-xs text-(--ink-soft)">{m.signed_in_as({ username })}</span>
			{/if}
			<ul class="mt-5 flex flex-col border-t-2 border-(--ink) text-sm">
				<li class="border-b border-(--paper-rule)">
					<button
						type="button"
						aria-expanded={open}
						onclick={() => (open = !open)}
						class={[
							'-mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-[2px] px-2 py-2.5 font-semibold transition-colors hover:bg-(--muted) focus-visible:outline-2 focus-visible:outline-(--oxblood)',
							open && 'bg-(--muted)',
						]}
					>
						{m.public_rooms()}
						<span class="flex items-center gap-1 font-normal text-(--ink-soft)">
							{rooms.length}<ChevronRight class="size-4" />
						</span>
					</button>
				</li>
				<li class="border-b border-(--paper-rule) py-2">
					<Button class="w-full" onclick={oncreate} disabled={creating}>{m.create_room()}</Button>
				</li>
				{#each [m.ranked_queue(), m.leaderboard()] as label (label)}
					<li class="flex items-baseline justify-between border-b border-(--paper-rule) py-2.5 text-(--ink-soft)">
						{label}<span class="text-xs">{m.coming_soon()}</span>
					</li>
				{/each}
				<li class="py-2.5">
					<a class="underline underline-offset-2 hover:text-(--ink)" href={resolve('/account')}>{m.account_link()}</a>
				</li>
			</ul>
		</nav>

		{#if open}
			<div
				class="paper w-full max-w-2xl rotate-[0.5deg] px-6 py-6"
				in:fly={{ x: 32, duration: 350, easing: cubicOut }}
			>
				<Button variant="ghost" size="sm" class="-ml-2 mb-2 md:hidden" onclick={() => (open = false)}>
					{m.close_menu()}
				</Button>
				<MenuList {rooms} {loaded} />
			</div>
		{/if}
	</div>
</main>
