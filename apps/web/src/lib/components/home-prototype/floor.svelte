<script lang="ts">
	// PROTOTYPE variant "floor": the kafana seen from the door. Far tables are
	// public rooms; the near table is yours to open.
	import { resolve } from '$app/paths';
	import type { PublicRoom } from '@belot/server';
	import { Button } from '#lib/components/ui/button/index.js';
	import ChairFigure from '#lib/components/match/chair-figure.svelte';
	import { m } from '#lib/paraglide/messages.js';

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

	// Seats fill in this order around a far table: across, right, left, near.
	const taken = (room: PublicRoom, order: number) => order < 4 - room.freeSeats;
</script>

{#snippet soonSlip(label: string, tilt: number)}
	<div class="paper flex items-baseline gap-2 px-3 py-1.5 text-xs" style:rotate="{tilt}deg">
		<span class="font-semibold">{label}</span>
		<span class="text-(--ink-soft)">{m.coming_soon()}</span>
	</div>
{/snippet}

<main class="table-skin room relative min-h-svh overflow-hidden text-(--ink)">
	<header class="flex h-[22svh] items-start justify-center gap-3 pt-4 md:justify-start md:gap-4 md:px-10 md:pt-6">
		{@render soonSlip(m.ranked_queue(), -1.2)}
		{@render soonSlip(m.leaderboard(), 0.9)}
	</header>

	<section
		class="mx-auto -mt-[8svh] flex max-w-5xl flex-wrap items-end justify-center gap-x-4 gap-y-6 px-3 [--seat-w:1.9rem] md:gap-x-10 md:[--seat-w:2.3rem]"
		aria-label={m.public_rooms()}
	>
		{#each rooms as room (room.id)}
			<a
				href={resolve('/rooms/[id]', { id: room.id })}
				class="group flex w-36 flex-col items-center rounded-[2px] outline-offset-4 focus-visible:outline-2 focus-visible:outline-(--oxblood) md:w-44"
			>
				<div class="relative h-26 w-full md:h-30" aria-hidden="true">
					<div class="absolute top-0 left-1/2 -translate-x-1/2"><ChairFigure occupied={taken(room, 0)} /></div>
					<div class="absolute inset-x-6 top-[38%] z-1 perspective-[600px] md:inset-x-8">
						<div class="cloth tabletop h-11 [--cloth-size:0.8rem] [--tilt:35deg] md:h-13"></div>
					</div>
					<div class="absolute top-[22%] left-0 z-2"><ChairFigure occupied={taken(room, 2)} /></div>
					<div class="absolute top-[22%] right-0 z-2"><ChairFigure occupied={taken(room, 1)} /></div>
					<div class="absolute bottom-0 left-1/2 z-3 -translate-x-1/2"><ChairFigure occupied={taken(room, 3)} /></div>
				</div>
				<div
					class="paper relative z-4 mt-1 flex w-full flex-col px-2.5 py-1.5 transition-transform duration-200 ease-out group-hover:-translate-y-1"
				>
					<span class="flex items-baseline justify-between gap-2">
						<span class="truncate text-sm font-semibold">{room.owner}</span>
						<span class="font-hand text-2xl leading-none font-bold tabular-nums">{room.targetScore}</span>
					</span>
					<span class="text-xs text-(--ink-soft)">{m.free_seats({ count: room.freeSeats })}</span>
				</div>
			</a>
		{:else}
			{#if loaded}
				<p class="paper max-w-xs rotate-[0.6deg] px-4 py-3 text-sm">{m.no_public_rooms()}</p>
			{/if}
		{/each}
	</section>

	<section class="mt-10 flex flex-col items-center pb-20 [--tilt:30deg] md:mt-12">
		<div class="perspective-[900px]">
			<div class="cloth tabletop grid place-items-center px-24 py-10 md:px-36 md:py-12" aria-hidden="true">
				{#each [-8, 4, 14] as tilt (tilt)}
					<div class="card-back col-start-1 row-start-1 h-20 w-14 md:h-24 md:w-17" style:rotate="{tilt}deg"></div>
				{/each}
			</div>
		</div>
		<div class="paper relative z-3 mt-8 flex w-60 -rotate-[0.8deg] flex-col gap-2 px-4 py-3">
			{#if username}
				<span class="flex items-baseline justify-between gap-2 text-sm">
					<span class="truncate font-semibold">{username}</span>
					<a class="text-xs text-(--ink-soft) underline underline-offset-2 hover:text-(--ink)" href={resolve('/account')}>
						{m.account_link()}
					</a>
				</span>
			{/if}
			<Button onclick={oncreate} disabled={creating}>{m.create_room()}</Button>
		</div>
	</section>
</main>
