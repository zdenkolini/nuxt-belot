<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import type { RoomMessage, RoomView, TargetScore } from '@belot/server';
	import { meQuery } from '#lib/account.js';
	import { api } from '#lib/api.js';
	import RoomChat from '#lib/components/room-chat.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { m } from '#lib/paraglide/messages.js';

	const targetScores: TargetScore[] = [501, 701, 1001];
	const id = $derived(page.params.id!);
	const me = createQuery(() => meQuery);

	// Replaced wholesale by each room the server sends.
	let room = $state<RoomView | null>(null);
	let closedReason = $state<(() => string) | null>(null);
	let notice = $state<string | null>(null);
	let socket = $state<ReturnType<ReturnType<typeof api.rooms>['ws']['subscribe']> | null>(null);

	$effect(() => {
		const roomId = id;
		let ws: ReturnType<ReturnType<typeof api.rooms>['ws']['subscribe']> | undefined;
		let stopped = false;
		(async () => {
			const { data, error } = await api.rooms({ id: roomId }).join.post({});
			if (stopped) return;
			if (error) {
				closedReason = error.status === 403 ? m.removed_from_room : m.room_not_found;
				return;
			}
			room = data;
			ws = api.rooms({ id: roomId }).ws.subscribe();
			socket = ws;
			ws.subscribe(({ data }) => {
				const message = data as RoomMessage;
				if (message.type === 'room') room = message.room;
				else if (message.type === 'removed') closedReason = m.removed_from_room;
			});
		})();
		return () => {
			stopped = true;
			ws?.close();
		};
	});

	const isOwner = $derived(!!room && room.ownerId === me.data?.id);
	const mySeat = $derived(room && me.data ? room.seats.indexOf(me.data.id) : -1);
	const usernameOf = (userId: string) =>
		room?.members.find((member) => member.id === userId)?.username ?? '';

	// Room changes come back over the socket; only failures need handling here.
	const act = async (request: Promise<{ error: { status: unknown } | null }>) => {
		notice = null;
		const { error } = await request;
		if (error) notice = error.status === 409 ? m.seat_taken() : m.room_action_failed();
	};

	const room$ = $derived(api.rooms({ id }));

	const copyInvite = async () => {
		await navigator.clipboard.writeText(`${location.origin}/rooms/${id}`);
		notice = m.invite_link_copied();
	};

	const start = async () => {
		notice = null;
		const { error } = await room$.start.post({});
		notice = error ? m.room_action_failed() : m.match_not_ready();
	};

	const leaveRoom = async () => {
		await room$.leave.post({});
		goto(resolve('/'));
	};
</script>

<svelte:head>
	<title>{m.room_title()} · {m.app_title()}</title>
</svelte:head>

<main class="flex min-h-svh items-center justify-center p-4">
	<Card.Root class="w-full max-w-lg">
		<Card.Header>
			<Card.Title>{m.room_title()}</Card.Title>
			{#if room && !closedReason}
				<Card.Description>
					{m.room_owner({ username: usernameOf(room.ownerId) })} ·
					{room.isPublic ? m.public_room() : m.private_room()}
				</Card.Description>
			{/if}
		</Card.Header>
		<Card.Content class="flex flex-col gap-6">
			{#if closedReason}
				<p role="status">{closedReason()}</p>
				<Button href={resolve('/')}>{m.back_home()}</Button>
			{:else if !room}
				<p>{m.connecting()}</p>
			{:else}
				<div class="flex flex-wrap gap-2">
					<Button variant="outline" onclick={copyInvite}>{m.copy_invite_link()}</Button>
					{#if isOwner}
						<Button
							variant="outline"
							onclick={() => act(room$.patch({ isPublic: !room!.isPublic }))}
						>
							{room.isPublic ? m.make_private() : m.make_public()}
						</Button>
					{/if}
				</div>

				<section class="flex flex-col gap-2">
					<h2 class="font-medium">{m.target_score()}</h2>
					<div class="flex gap-2" role="group" aria-label={m.target_score()}>
						{#each targetScores as score (score)}
							<Button
								variant={room.targetScore === score ? 'default' : 'outline'}
								size="sm"
								disabled={!isOwner}
								aria-pressed={room.targetScore === score}
								onclick={() => act(room$.patch({ targetScore: score }))}>{score}</Button
							>
						{/each}
					</div>
				</section>

				<ol class="grid grid-cols-2 gap-2">
					{#each room.seats as userId, seat (seat)}
						<li class="flex flex-col gap-1 rounded-lg border p-3 text-sm">
							<span class="text-muted-foreground">
								{m.seat_number({ number: seat + 1 })} · {m.team_number({ number: (seat % 2) + 1 })}
							</span>
							<span class="font-medium">{userId ? usernameOf(userId) : m.free_seat()}</span>
							{#if userId === null}
								<Button size="sm" onclick={() => act(room$.seat.put({ seat }))}>
									{m.take_seat()}
								</Button>
							{:else if seat === mySeat}
								<Button size="sm" variant="outline" onclick={() => act(room$.seat.delete({}))}>
									{m.leave_seat()}
								</Button>
							{/if}
						</li>
					{/each}
				</ol>

				<section class="flex flex-col gap-2">
					<h2 class="font-medium">{m.players()}</h2>
					<ul class="flex flex-col gap-1 text-sm">
						{#each room.members as member (member.id)}
							<li class="flex items-center justify-between gap-2">
								<span>{member.username}</span>
								{#if isOwner && member.id !== room.ownerId}
									<Button
										size="xs"
										variant="destructive"
										onclick={() => act(room$.members({ memberId: member.id }).delete({}))}
									>
										{m.remove_player()}
									</Button>
								{/if}
							</li>
						{/each}
					</ul>
				</section>

				{#if socket}
					<RoomChat {socket} members={room.members} myId={me.data?.id} />
				{/if}

				{#if notice}
					<p class="text-sm" role="status">{notice}</p>
				{/if}

				<div class="flex flex-wrap justify-between gap-2">
					{#if isOwner}
						<div class="flex flex-col gap-1">
							<Button onclick={start} disabled={room.seats.includes(null)}>{m.start_match()}</Button>
							{#if room.seats.includes(null)}
								<p class="text-sm text-muted-foreground">{m.start_needs_four()}</p>
							{/if}
						</div>
					{/if}
					<Button variant="outline" onclick={leaveRoom}>{m.leave_room()}</Button>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</main>
