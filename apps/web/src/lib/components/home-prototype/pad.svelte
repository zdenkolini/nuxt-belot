<script lang="ts">
	// PROTOTYPE variant "pad": your table on the left, a waiter's ruled order pad
	// of open tables on the right.
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
</script>

<main class="table-skin room min-h-svh px-3 py-6 text-(--ink) md:px-10 md:py-10">
	<div class="mx-auto grid max-w-6xl items-center gap-10 pb-16 md:min-h-[calc(100svh-5rem)] md:grid-cols-[1fr_22rem]">
		<section class="flex flex-col items-center [--tilt:22deg] md:[--tilt:34deg]">
			<div class="perspective-[900px]">
				<div class="cloth tabletop grid place-items-center px-24 py-14 md:px-40 md:py-24" aria-hidden="true">
					{#each [-8, 4, 14] as tilt (tilt)}
						<div class="card-back col-start-1 row-start-1 h-20 w-14 md:h-28 md:w-20" style:rotate="{tilt}deg"></div>
					{/each}
				</div>
			</div>
			<div class="paper relative z-3 mt-8 flex rotate-[0.6deg] items-center gap-4 px-4 py-3 md:mt-12">
				{#if username}
					<span class="flex flex-col">
						<span class="text-sm font-semibold">{username}</span>
						<a class="text-xs text-(--ink-soft) underline underline-offset-2 hover:text-(--ink)" href={resolve('/account')}>
							{m.account_link()}
						</a>
					</span>
				{/if}
				<Button size="lg" onclick={oncreate} disabled={creating}>{m.create_room()}</Button>
			</div>
		</section>

		<div class="flex flex-col gap-5">
			<section class="paper -rotate-[0.8deg] px-5 pt-4 pb-5" aria-labelledby="pad-title">
				<h1 id="pad-title" class="font-hand text-4xl leading-none font-bold">{m.public_rooms()}</h1>
				<ul class="mt-3 border-t-2 border-(--ink)">
					{#each rooms as room (room.id)}
						<li class="grid grid-cols-[1fr_auto_3.5rem_auto] items-center gap-3 border-b border-(--paper-rule) py-1.5">
							<span class="truncate text-sm font-semibold">{room.owner}</span>
							<span class="flex gap-0.5" role="img" aria-label={m.free_seats({ count: room.freeSeats })}>
								{#each [0, 1, 2, 3] as seat (seat)}
									<span
										class={[
											'size-2.5 rounded-[1px] border border-(--ink)',
											seat < 4 - room.freeSeats && 'bg-(--ink)',
										]}
									></span>
								{/each}
							</span>
							<span class="text-right font-hand text-2xl leading-7 tabular-nums">{room.targetScore}</span>
							<Button variant="outline" size="sm" href={resolve('/rooms/[id]', { id: room.id })}>{m.join()}</Button>
						</li>
					{:else}
						{#if loaded}
							<li class="border-b border-(--paper-rule) py-2 text-sm text-(--ink-soft)">{m.no_public_rooms()}</li>
						{/if}
					{/each}
				</ul>
			</section>

			<section class="paper flex rotate-[0.5deg] flex-col gap-1.5 px-5 py-3 text-sm text-(--ink-soft)">
				{#each [m.ranked_queue(), m.leaderboard()] as label (label)}
					<span class="flex items-baseline justify-between">
						<span>{label}</span>
						<span class="text-xs">{m.coming_soon()}</span>
					</span>
				{/each}
			</section>
		</div>
	</div>
</main>
