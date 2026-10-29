<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { MediaQuery } from 'svelte/reactivity';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		targetScores,
		teamOf,
		type BelotMove,
		type DealScore,
		type Seat,
		type TeamPoints,
		type Trick,
	} from '@belot/engine';
	import type { MatchView, RoomMessage, RoomView } from '@belot/server';
	import { meQuery } from '#lib/account.js';
	import { api, type RoomSocket } from '#lib/api.js';
	import RoomChat from '#lib/components/room-chat.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import ChairFigure from '#lib/components/match/chair-figure.svelte';
	import MatchScreen from '#lib/components/match/match-screen.svelte';
	import MatchPause from '#lib/components/match-pause.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { usernameIn } from '#lib/players.js';

	const id = $derived(page.params.id!);
	const me = createQuery(() => meQuery);

	// Replaced wholesale by each room the server sends.
	let room = $state<RoomView | null>(null);
	let closedReason = $state<(() => string) | null>(null);
	// A claim link opened during a running match comes back here.
	let notice = $state<string | null>(
		page.url.searchParams.get('claim') === 'match_running' ? m.claim_after_match() : null,
	);
	let socket = $state<RoomSocket | null>(null);
	// Replaced wholesale by each match view the server sends.
	let match = $state<MatchView | null>(null);
	let lastTrick = $state<Trick | null>(null);
	let dealScore = $state<DealScore | null>(null);
	// Deals scored while this page is open, for the score pad.
	let deals = $state<TeamPoints[]>([]);
	let sendMove: ((move: BelotMove) => void) | undefined;
	let endMatch: (() => void) | undefined;

	const onMatch = (next: MatchView) => {
		if (match?.result && !next.result) {
			lastTrick = null;
			dealScore = null;
			deals = [];
		}
		for (const event of next.events) {
			if (event.type === 'trickWon') {
				const played = next.events.find((e) => e.type === 'played');
				const plays =
					match && played
						? [...match.view.trick, { seat: played.seat, card: played.card }]
						: [];
				lastTrick = { plays, winner: event.seat };
			}
			if (event.type === 'dealScored') {
				dealScore = event.score;
				deals = [...deals, event.score.points];
			}
		}
		if (next.view.trick.length > 0) lastTrick = null;
		match = next;
	};

	$effect(() => {
		const roomId = id;
		let ws: RoomSocket | undefined;
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
				else if (message.type === 'match') onMatch(message.match);
				else if (message.type === 'match.rejected')
					notice = message.reason === 'paused' ? m.match_paused() : m.move_rejected();
				else if (message.type === 'removed') closedReason = m.removed_from_room;
			});
			sendMove = (move) => ws?.send({ type: 'match.move', move });
			endMatch = () => ws?.send({ type: 'match.end' });
		})();
		return () => {
			stopped = true;
			ws?.close();
		};
	});

	const isOwner = $derived(!!room && room.ownerId === me.data?.id);
	const mySeat = $derived(room && me.data ? room.seats.indexOf(me.data.id) : -1);
	const usernameOf = (userId: string) => usernameIn(room!.members, userId);
	// Seats around the table from my point of view: 0 bottom, 1 right, 2 top, 3 left.
	const seatAt = (place: number) => (((mySeat < 0 ? 0 : mySeat) + place) % 4) as Seat;
	const wide = new MediaQuery('min-width: 48rem');

	// Room changes come back over the socket; only failures need handling here.
	const act = async (
		request: Promise<{ error: { status: unknown; value: unknown } | null }>,
	) => {
		notice = null;
		const { error } = await request;
		if (!error) return;
		const value = error.value as { error?: string } | undefined;
		notice =
			value?.error === 'seated_in_match'
				? m.seated_in_match()
				: value?.error === 'match_running'
				? m.match_running()
				: error.status === 409
					? m.seat_taken()
					: m.room_action_failed();
	};

	const roomApi = $derived(api.rooms({ id }));

	const copyInvite = async () => {
		await navigator.clipboard.writeText(`${location.origin}/rooms/${id}`);
		notice = m.invite_link_copied();
	};

	const start = () => act(roomApi.start.post({}));

	const move = (next: BelotMove) => {
		notice = null;
		sendMove?.(next);
	};

	const backToRoom = () => {
		match = null;
		lastTrick = null;
		dealScore = null;
		deals = [];
	};

	const leaveRoom = async () => {
		await roomApi.leave.post({});
		goto(resolve('/'));
	};
</script>

<!-- A seat at the lobby table: an empty or taken chair, and its name card. -->
{#snippet seatSpot(place: number, chair: boolean)}
	{@const seat = seatAt(place)}
	{@const userId = room!.seats[seat]}
	<div class="flex flex-col items-center">
		{#if chair}<ChairFigure occupied={userId !== null} />{/if}
		<div class="paper relative z-3 mt-1.5 flex w-40 flex-col gap-1 px-3 py-2 text-sm md:w-44">
			<span class={['truncate', userId ? 'font-semibold' : 'text-(--ink-soft) italic']}>
				{userId ? usernameOf(userId) : m.free_seat()}
			</span>
			<span class="text-xs text-(--ink-soft)">
				{m.seat_number({ number: seat + 1 })} · {m.team_number({ number: teamOf(seat) + 1 })}
			</span>
			{#if userId === null}
				<Button size="sm" onclick={() => act(roomApi.seat.put({ seat }))}>{m.take_seat()}</Button>
				<!-- Bots exist only on dev servers, for testing a match alone. -->
				{#if isOwner && import.meta.env.DEV}
					<Button size="sm" variant="ghost" onclick={() => act(roomApi.bots.post({ seat }))}>
						{m.add_bot()}
					</Button>
				{/if}
			{:else if seat === mySeat}
				<Button size="sm" variant="outline" onclick={() => act(roomApi.seat.delete({}))}>
					{m.leave_seat()}
				</Button>
			{/if}
		</div>
	</div>
{/snippet}

<svelte:head>
	<title>{m.room_title()} · {m.app_title()}</title>
</svelte:head>

{#if room && match && !closedReason}
	<MatchScreen
		{match}
		{room}
		{lastTrick}
		{dealScore}
		{deals}
		{isOwner}
		onmove={move}
		ondismissscore={() => (dealScore = null)}
		onplayagain={start}
		onback={backToRoom}
		onleave={leaveRoom}
	>
		{#snippet chat()}
			{#if socket}
				<RoomChat {socket} members={room!.members} myId={me.data?.id} />
			{/if}
		{/snippet}
	</MatchScreen>
	<MatchPause {match} onend={() => endMatch?.()} onback={backToRoom} />
	{#if notice}
		<p class="paper fixed inset-x-0 top-3 z-20 mx-auto w-fit px-3 py-1.5 text-sm font-medium" role="status">
			{notice}
		</p>
	{/if}
{:else}
	<main class="table-skin room min-h-svh px-3 py-4 text-(--ink) md:px-8 md:py-10">
		{#if closedReason || !room}
			<div class="paper mx-auto mt-[20svh] flex max-w-sm flex-col gap-4 px-5 py-5">
				<h1 class="font-hand text-4xl leading-none font-bold">{m.room_title()}</h1>
				{#if closedReason}
					<p role="status">{closedReason()}</p>
					<Button href={resolve('/')} class="self-start">{m.back_home()}</Button>
				{:else}
					<p role="status">{m.connecting()}</p>
				{/if}
			</div>
		{:else}
			<div class="mx-auto grid max-w-6xl items-start gap-6 md:min-h-[calc(100svh-5rem)] md:grid-cols-[1fr_20rem] md:items-center md:gap-10">
				<section
					class="flex flex-col items-center [--seat-w:3.5rem] [--tilt:22deg] md:[--seat-w:clamp(4.5rem,7vw,6.5rem)] md:[--tilt:34deg]"
					aria-label={m.players()}
				>
					<div class="relative -mb-2 md:-mb-[calc(var(--seat-w)*0.8)]">{@render seatSpot(2, true)}</div>
					<div class="grid w-full grid-cols-[1fr_auto_1fr] items-center">
						{#if wide.current}
							<div class="relative z-3 col-start-1 row-start-1 -mr-6 self-center justify-self-end">
								{@render seatSpot(3, true)}
							</div>
						{/if}
						<div class="relative z-1 col-span-3 col-start-1 row-start-1 justify-self-center perspective-[900px] md:col-span-1 md:col-start-2">
							<div class="cloth tabletop grid place-items-center px-24 py-14 md:px-36 md:py-20" aria-hidden="true">
								{#each [-8, 4, 14] as tilt (tilt)}
									<div
										class="card-back col-start-1 row-start-1 h-20 w-14 md:h-28 md:w-20"
										style:rotate="{tilt}deg"
									></div>
								{/each}
							</div>
						</div>
						{#if wide.current}
							<div class="relative z-3 col-start-3 row-start-1 -ml-6 self-center justify-self-start">
								{@render seatSpot(1, true)}
							</div>
						{/if}
					</div>
					{#if !wide.current}
						<div class="relative z-3 mt-6 flex gap-3">
							{@render seatSpot(3, false)}
							{@render seatSpot(1, false)}
						</div>
					{/if}
					<div class="relative z-3 mt-4 md:mt-8">{@render seatSpot(0, false)}</div>
				</section>

				<div class="flex flex-col gap-5">
					<section class="paper flex -rotate-[0.6deg] flex-col gap-4 px-5 py-4">
						<header class="flex flex-col gap-1">
							<h1 class="font-hand text-4xl leading-none font-bold">{m.room_title()}</h1>
							<p class="text-xs text-(--ink-soft)">
								{m.room_owner({ username: usernameOf(room.ownerId) })} ·
								{room.isPublic ? m.public_room() : m.private_room()}
							</p>
						</header>

						<div class="flex flex-col gap-1">
							<h2 class="text-sm font-semibold">{m.target_score()}</h2>
							<div class="flex gap-1" role="group" aria-label={m.target_score()}>
								{#each targetScores as score (score)}
									{@const chosen = room.targetScore === score}
									<button
										type="button"
										class={[
											'relative px-3 py-1 font-hand text-3xl leading-none tabular-nums focus-visible:outline-2 focus-visible:outline-(--oxblood)',
											chosen ? 'font-bold' : 'text-(--ink-soft)',
											isOwner && !chosen && 'cursor-pointer hover:text-(--ink)',
										]}
										disabled={!isOwner}
										aria-pressed={chosen}
										onclick={() => act(roomApi.patch({ targetScore: score }))}
									>
										{score}
										{#if chosen}
											<svg
												class="pointer-events-none absolute -inset-x-0.5 -inset-y-1 h-[calc(100%+0.5rem)] w-[calc(100%+0.25rem)] text-(--oxblood)"
												viewBox="0 0 100 50"
												preserveAspectRatio="none"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M58 5C30 2 5 10 4 25s22 21 48 20 45-8 44-22S72 2 40 6"
													stroke="currentColor"
													stroke-width="2.5"
													stroke-linecap="round"
													vector-effect="non-scaling-stroke"
												/>
											</svg>
										{/if}
									</button>
								{/each}
							</div>
						</div>

						<div class="flex flex-wrap gap-2">
							<Button variant="outline" size="sm" onclick={copyInvite}>{m.copy_invite_link()}</Button>
							{#if isOwner}
								<Button
									variant="outline"
									size="sm"
									onclick={() => act(roomApi.patch({ isPublic: !room!.isPublic }))}
								>
									{room.isPublic ? m.make_private() : m.make_public()}
								</Button>
							{/if}
						</div>

						{#if notice}
							<p class="text-sm font-medium text-(--oxblood)" role="status">{notice}</p>
						{/if}

						<div class="flex flex-col gap-2 border-t border-(--border) pt-4">
							{#if isOwner}
								<Button size="lg" onclick={start} disabled={room.seats.includes(null)}>
									{m.start_match()}
								</Button>
								{#if room.seats.includes(null)}
									<p class="text-xs text-(--ink-soft)">{m.start_needs_four()}</p>
								{/if}
							{/if}
							<Button variant="ghost" size="sm" class="self-start" onclick={leaveRoom}>
								{m.leave_room()}
							</Button>
						</div>
					</section>

					<section class="paper flex rotate-[0.5deg] flex-col gap-2 px-5 py-4 text-sm">
						<h2 class="font-semibold">{m.players()}</h2>
						<ul class="flex flex-col gap-1">
							{#each room.members as member (member.id)}
								<li class="flex items-center justify-between gap-2">
									<span>{member.username}</span>
									{#if isOwner && member.id !== room.ownerId}
										<Button
											size="xs"
											variant="destructive"
											onclick={() => act(roomApi.members({ userId: member.id }).delete({}))}
										>
											{m.remove_player()}
										</Button>
									{/if}
								</li>
							{/each}
						</ul>
					</section>

					{#if socket}
						<div class="paper -rotate-[0.4deg] px-5 py-4 text-sm">
							<RoomChat {socket} members={room.members} myId={me.data?.id} />
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</main>
{/if}
