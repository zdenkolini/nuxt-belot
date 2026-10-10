<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { meQuery } from '#lib/account.js';
	import { api } from '#lib/api.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { m } from '#lib/paraglide/messages.js';

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
</script>

<svelte:head>
	<title>{m.app_title()}</title>
</svelte:head>

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
