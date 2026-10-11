<script lang="ts">
	// PROTOTYPE: the kafana menu of public rooms. Sections are target scores,
	// a room is a dish: host as its name, players as ingredients, rating as price.
	import { resolve } from '$app/paths';
	import { targetScores } from '@belot/engine';
	import type { PublicRoom } from '@belot/server';
	import Search from '@lucide/svelte/icons/search';
	import { Input } from '#lib/components/ui/input/index.js';
	import { m } from '#lib/paraglide/messages.js';

	let { rooms, loaded }: { rooms: PublicRoom[]; loaded: boolean } = $props();

	let query = $state('');
	let freeOnly = $state(false);

	// PROTOTYPE: no ratings exist yet; a stable made-up number per username.
	const rating = (name: string) => {
		let h = 0;
		for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
		return 1000 + (Math.abs(h) % 900);
	};
	const price = (room: PublicRoom) => {
		const names = room.players.filter((p) => p !== null);
		if (!names.length) return null;
		return Math.round(names.reduce((sum, p) => sum + rating(p), 0) / names.length);
	};

	const shown = $derived(
		rooms.filter((room) => {
			if (freeOnly && room.players.length >= 4) return false;
			const q = query.trim().toLowerCase();
			return !q || [room.owner, ...room.players].some((n) => n?.toLowerCase().includes(q));
		}),
	);
</script>

<section class="flex flex-col gap-4" aria-labelledby="menu-title">
	<h2 id="menu-title" class="font-hand text-4xl leading-none font-bold">{m.public_rooms()}</h2>

	<div class="flex flex-wrap items-center gap-2">
		<label class="relative min-w-48 flex-1">
			<span class="sr-only">{m.search_rooms()}</span>
			<Search class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-(--ink-soft)" />
			<Input bind:value={query} type="search" placeholder={m.search_rooms_placeholder()} class="rounded-(--radius) pl-8" />
		</label>
		<button
			type="button"
			aria-pressed={freeOnly}
			onclick={() => (freeOnly = !freeOnly)}
			class={[
				'h-8 rounded-(--radius) border px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--oxblood)',
				freeOnly
					? 'border-(--oxblood) bg-(--oxblood) text-(--card-face)'
					: 'border-(--border) hover:bg-(--muted)',
			]}
		>
			{m.with_free_seat()}
		</button>
	</div>

	{#each targetScores as score (score)}
		{@const section = shown.filter((room) => room.targetScore === score)}
		{#if section.length}
			<div>
				<h3 class="flex items-baseline justify-between border-b-2 border-(--ink) pb-1 text-sm font-semibold">
					{m.target_score_value({ score })}
					<span class="text-xs font-normal text-(--ink-soft)">{m.rating()}</span>
				</h3>
				<ul>
					{#each section as room (room.id)}
						{@const cost = price(room)}
						<li class="border-b border-(--paper-rule)">
							<a
								href={resolve('/rooms/[id]', { id: room.id })}
								class="-mx-2 flex flex-col rounded-[2px] px-2 py-2 transition-colors hover:bg-(--muted) focus-visible:outline-2 focus-visible:outline-(--oxblood)"
							>
								<span class="flex items-baseline gap-2">
									<span class="font-semibold">{m.room_of({ owner: room.owner ?? '' })}</span>
									<span class="mb-1 flex-1 border-b-2 border-dotted border-(--ink-soft)/50" aria-hidden="true"></span>
									<span class="font-hand text-2xl leading-6 tabular-nums">{cost ?? '–'}</span>
								</span>
								<span class="text-xs text-(--ink-soft)">
									{room.players.filter((p) => p !== null).join(', ')}
									{#if room.players.length < 4}
										{room.players.length ? ' · ' : ''}{m.free_seats({ count: 4 - room.players.length })}
									{/if}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/each}

	{#if loaded && !shown.length}
		<p class="text-sm text-(--ink-soft)">{rooms.length ? m.no_matching_rooms() : m.no_public_rooms()}</p>
	{/if}
</section>
