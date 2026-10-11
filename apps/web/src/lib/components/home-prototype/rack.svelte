<script lang="ts">
	// PROTOTYPE variant "rack": public rooms hang as paper tags on a coat rack
	// on the wall; your table stands on the floor below.
	import { resolve } from '$app/paths';
	import type { PublicRoom } from '@belot/server';
	import { Button } from '#lib/components/ui/button/index.js';
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

	const tilts = [-3, 2, -1.5, 3.5, -2.5, 1];
</script>

{#snippet hook()}
	<span class="mx-auto block h-3 w-3 rounded-full bg-(--wall-trim) shadow-[0_2px_2px_oklch(0.1_0.02_40/0.6)]"></span>
	<span class="mx-auto block h-3 w-px bg-(--ink-soft)"></span>
{/snippet}

<main class="table-skin relative min-h-svh overflow-hidden bg-(--floor) text-(--ink)">
	<div
		class="absolute inset-0 [background-image:radial-gradient(ellipse_75%_55%_at_50%_70%,var(--lamp),transparent_70%),radial-gradient(ellipse_at_50%_50%,transparent_50%,oklch(0.12_0.03_40/0.65)),repeating-linear-gradient(90deg,var(--floor)_0_4.5rem,var(--floor-seam)_4.5rem_calc(4.5rem+2px))]"
		aria-hidden="true"
	></div>

	<section class="relative bg-(--wall) px-3 pt-8 pb-10 md:px-10" aria-label={m.public_rooms()}>
		<div class="mx-auto h-3 max-w-5xl rounded-[2px] bg-(--chair) shadow-[0_4px_6px_oklch(0.1_0.02_40/0.5)]" aria-hidden="true"></div>
		<ul class="mx-auto -mt-1.5 flex max-w-5xl flex-wrap justify-center gap-x-5 gap-y-8 md:gap-x-8">
			{#each rooms as room, i (room.id)}
				<li class="w-28 md:w-32">
					<div aria-hidden="true">{@render hook()}</div>
					<a
						href={resolve('/rooms/[id]', { id: room.id })}
						class="paper flex origin-top flex-col items-center px-3 pt-2 pb-3 transition-transform duration-300 ease-out outline-offset-2 hover:rotate-0! focus-visible:outline-2 focus-visible:outline-(--oxblood)"
						style:rotate="{tilts[i % tilts.length]}deg"
					>
						<span class="mb-1 size-2 rounded-full border border-(--border) bg-(--wall)" aria-hidden="true"></span>
						<span class="w-full truncate text-center text-sm font-semibold">{room.owner}</span>
						<span class="font-hand text-3xl leading-9 font-bold tabular-nums">{room.targetScore}</span>
						<span class="text-xs text-(--ink-soft)">{m.free_seats({ count: room.freeSeats })}</span>
					</a>
				</li>
			{:else}
				{#if loaded}
					<li class="w-56">
						<div aria-hidden="true">{@render hook()}</div>
						<p class="paper -rotate-1 px-3 py-2 text-sm">{m.no_public_rooms()}</p>
					</li>
				{/if}
			{/each}
			{#each [m.ranked_queue(), m.leaderboard()] as label, i (label)}
				<li class="w-28 opacity-80 md:w-32">
					<div aria-hidden="true">{@render hook()}</div>
					<div class="paper flex flex-col items-center px-3 py-2 text-(--ink-soft)" style:rotate="{i ? 2.5 : -2}deg">
						<span class="text-center text-sm font-semibold">{label}</span>
						<span class="text-xs">{m.coming_soon()}</span>
					</div>
				</li>
			{/each}
		</ul>
	</section>
	<div class="relative h-1.5 bg-(--wall-trim)" aria-hidden="true"></div>

	<section class="relative flex flex-col items-center pt-12 pb-24 [--tilt:30deg]">
		<div class="perspective-[900px]">
			<div class="cloth tabletop grid place-items-center px-24 py-12 md:px-36 md:py-16" aria-hidden="true">
				{#each [-8, 4, 14] as tilt (tilt)}
					<div class="card-back col-start-1 row-start-1 h-20 w-14 md:h-24 md:w-17" style:rotate="{tilt}deg"></div>
				{/each}
			</div>
		</div>
		<div class="paper relative z-3 mt-8 flex w-60 rotate-[0.7deg] flex-col gap-2 px-4 py-3">
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
