<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { meQuery } from '#lib/account.js';
	import { api } from '#lib/api.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PublicRoom } from '@belot/server';
	import Floor from '#lib/components/home-prototype/floor.svelte';
	import Pad from '#lib/components/home-prototype/pad.svelte';
	import Rack from '#lib/components/home-prototype/rack.svelte';
	import PrototypeSwitcher from '#lib/components/prototype-switcher.svelte';

	const me = createQuery(() => meQuery);
	const publicRooms = createQuery(() => ({
		queryKey: ['rooms'],
		queryFn: async () => {
			const { data, error } = await api.rooms.get();
			if (error) throw error;
			return data;
		},
		refetchInterval: 10_000,
	}));

	let creating = $state(false);

	const createRoom = async () => {
		creating = true;
		const { data } = await api.rooms.post({});
		creating = false;
		if (data) goto(resolve('/rooms/[id]', { id: data.id }));
	};

	// PROTOTYPE: three home layouts, ?variant=floor|pad|rack; ?demo adds made-up rooms.
	const variants = [
		{ key: 'floor', name: 'Kafana floor' },
		{ key: 'pad', name: "Waiter's pad" },
		{ key: 'rack', name: 'Coat rack' },
		{ key: 'old', name: 'Current page' },
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'floor');
	const demoRooms: PublicRoom[] = [
		{ id: 'demo-1', owner: 'marko_bg', targetScore: 701, freeSeats: 1 },
		{ id: 'demo-2', owner: 'ana', targetScore: 501, freeSeats: 2 },
		{ id: 'demo-3', owner: 'joca1001', targetScore: 1001, freeSeats: 3 },
		{ id: 'demo-4', owner: 'vesna_ns', targetScore: 701, freeSeats: 1 },
		{ id: 'demo-5', owner: 'dule', targetScore: 501, freeSeats: 3 },
	];
	const rooms = $derived([
		...(publicRooms.data ?? []),
		...(page.url.searchParams.has('demo') ? demoRooms : []),
	]);
	const props = $derived({
		rooms,
		loaded: publicRooms.isSuccess,
		username: me.data?.username ?? null,
		creating,
		oncreate: createRoom,
	});
</script>

<svelte:head>
	<title>{m.app_title()}</title>
</svelte:head>

<PrototypeSwitcher {variants} />
{#if variant === 'floor'}
	<Floor {...props} />
{:else if variant === 'pad'}
	<Pad {...props} />
{:else if variant === 'rack'}
	<Rack {...props} />
{:else}
<main class="flex min-h-svh items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header>
			<Card.Title>{m.app_title()}</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-col gap-6">
			<Button onclick={createRoom} disabled={creating}>{m.create_room()}</Button>
			<section class="flex flex-col gap-3">
				<h2 class="font-medium">{m.public_rooms()}</h2>
				{#if publicRooms.data?.length}
					<ul class="flex flex-col gap-2">
						{#each publicRooms.data as room (room.id)}
							<li class="flex items-center justify-between gap-2 text-sm">
								<span>
									{m.room_of({ owner: room.owner ?? '' })} ·
									{m.free_seats({ count: room.freeSeats })} ·
									{m.target_score_value({ score: room.targetScore })}
								</span>
								<Button
									variant="outline"
									size="sm"
									href={resolve('/rooms/[id]', { id: room.id })}>{m.join()}</Button
								>
							</li>
						{/each}
					</ul>
				{:else if publicRooms.isSuccess}
					<p class="text-sm text-muted-foreground">{m.no_public_rooms()}</p>
				{/if}
			</section>
		</Card.Content>
		{#if me.data?.username}
			<Card.Footer class="flex justify-between gap-2 text-sm">
				<span>{m.signed_in_as({ username: me.data.username })}</span>
				<a class="underline" href={resolve('/account')}>{m.account_link()}</a>
			</Card.Footer>
		{/if}
	</Card.Root>
</main>
{/if}
