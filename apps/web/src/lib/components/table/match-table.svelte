<script lang="ts">
	import type { Snippet } from 'svelte';
	import { flip } from 'svelte/animate';
	import type { BelotMove, DealScore, Play, Seat, Team } from '@belot/engine';
	import type { MatchView, RoomView } from '@belot/server';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { receive, send, sortHand, suitNames, suitSymbols } from './cards.js';
	import DealScoreTable from './deal-score.svelte';
	import PlayingCard from './playing-card.svelte';

	let {
		match,
		room,
		lastTrick,
		dealScore,
		isOwner,
		onmove,
		ondismissscore,
		onplayagain,
		onback,
		chat,
	}: {
		match: MatchView;
		room: RoomView;
		lastTrick: { plays: Play[]; winner: Seat } | null;
		dealScore: DealScore | null;
		isOwner: boolean;
		onmove: (move: BelotMove) => void;
		ondismissscore: () => void;
		onplayagain: () => void;
		onback: () => void;
		chat?: Snippet;
	} = $props();

	const view = $derived(match.view);
	const myTeam = $derived((match.seat % 2) as Team);
	const usernameOf = (seat: Seat) =>
		room.members.find((member) => member.id === room.seats[seat])?.username ?? '';
	// Seats around the table from my point of view: 0 me, 1 right, 2 top, 3 left.
	const at = (offset: number) => ((match.seat + offset) % 4) as Seat;
	const placeOf = (seat: Seat) => (seat - match.seat + 4) % 4;
	const places = [
		'col-start-2 row-start-3',
		'col-start-3 row-start-2',
		'col-start-2 row-start-1',
		'col-start-1 row-start-2',
	];

	const playable = $derived(
		new Set(match.legalMoves.flatMap((move) => (move.type === 'play' ? [move.card.id] : []))),
	);
	const calls = $derived(match.legalMoves.filter((move) => move.type !== 'play'));
	const canPass = $derived(calls.some((move) => move.type === 'pass'));
	const shownTrick = $derived(view.trick.length > 0 ? view.trick : (lastTrick?.plays ?? []));
	const teamName = (team: Team) =>
		team === myTeam ? m.team_you({ number: team + 1 }) : m.team_number({ number: team + 1 });
</script>

{#snippet seat(seat: Seat)}
	<div
		class={[
			'flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-sm',
			match.turn === seat && 'border-primary ring-2 ring-primary',
		]}
	>
		<span class="font-medium">{usernameOf(seat)}</span>
		<span class="text-xs text-muted-foreground">
			{m.cards_in_hand({ count: view.cardCounts[seat] ?? 0 })}
			{#if view.dealer === seat}· {m.dealer()}{/if}
		</span>
		<div class="flex" aria-hidden="true">
			{#each { length: view.cardCounts[seat] ?? 0 }, i (i)}
				<div class="-ml-3 h-6 w-4 rounded-sm border bg-primary first:ml-0"></div>
			{/each}
		</div>
	</div>
{/snippet}

<div class="flex min-h-svh flex-col md:flex-row">
	<aside
		class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b p-3 text-sm md:order-last md:w-72 md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-l md:p-4"
	>
		<section class="flex flex-col gap-1" aria-label={m.totals_to({ target: room.targetScore })}>
			<h2 class="text-xs text-muted-foreground">{m.totals_to({ target: room.targetScore })}</h2>
			<div class="flex gap-4 tabular-nums md:flex-col md:gap-1">
				{#each [0, 1] as const as team (team)}
					<span class="flex justify-between gap-2">
						<span>{teamName(team)}</span>
						<span class="font-semibold">{view.scores[team]}</span>
					</span>
				{/each}
			</div>
		</section>
		<p>
			{#if view.trump && view.caller !== null}
				<span aria-hidden="true">{suitSymbols[view.trump]}</span>
				{m.trump_called_by({ suit: suitNames[view.trump](), username: usernameOf(view.caller) })}
			{:else}
				{m.calling_trump()}
			{/if}
		</p>
		{#if dealScore}
			<section class="hidden flex-col gap-2 md:flex">
				<h2 class="font-medium">{m.deal_score()}</h2>
				<DealScoreTable score={dealScore} {myTeam} />
			</section>
		{/if}
		{#if chat}
			<details class="w-full">
				<summary class="cursor-pointer font-medium">{m.chat()}</summary>
				<div class="pt-2">{@render chat()}</div>
			</details>
		{/if}
	</aside>

	<main class="flex flex-1 flex-col items-center justify-between gap-4 p-3 md:p-6">
		{@render seat(at(2))}

		<div class="flex w-full max-w-2xl items-center justify-between gap-2">
			{@render seat(at(3))}
			<section
				class="grid grid-cols-3 grid-rows-3 place-items-center gap-1"
				aria-label={m.trick()}
			>
				{#each shownTrick as play (play.card.id)}
					<div
						class={places[placeOf(play.seat)]}
						animate:flip={{ duration: 300 }}
						in:receive={{ key: play.card.id }}
						out:send={{ key: play.card.id }}
					>
						<PlayingCard card={play.card} />
					</div>
				{/each}
				<p class="col-start-2 row-start-2 text-center text-xs text-muted-foreground" role="status">
					{#if view.trick.length === 0 && lastTrick}
						{m.trick_won_by({ username: usernameOf(lastTrick.winner) })}
					{/if}
				</p>
			</section>
			{@render seat(at(1))}
		</div>

		<section class="flex w-full flex-col items-center gap-3" aria-label={m.your_hand()}>
			<p class="text-sm font-medium" role="status">
				{#if match.turn === match.seat}
					{m.your_turn()}
				{:else if match.turn !== null}
					{m.turn_of({ username: usernameOf(match.turn) })}
				{/if}
				{#if view.dealer === match.seat}· {m.dealer()}{/if}
			</p>

			{#if calls.length > 0}
				<div class="flex flex-col items-center gap-2">
					<p class="text-sm">{canPass ? m.call_trump() : m.must_call()}</p>
					<div class="flex flex-wrap justify-center gap-2">
						{#each calls as move (move.type === 'call' ? move.suit : 'pass')}
							<Button variant={move.type === 'pass' ? 'outline' : 'default'} onclick={() => onmove(move)}>
								{#if move.type === 'call'}
									<span aria-hidden="true">{suitSymbols[move.suit]}</span>
									{suitNames[move.suit]()}
								{:else}
									{m.pass()}
								{/if}
							</Button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="flex justify-center">
				{#each sortHand(view.hand) as card (card.id)}
					<div
						class="-ml-5 first:ml-0 sm:ml-1"
						animate:flip={{ duration: 300 }}
						in:receive={{ key: card.id }}
						out:send={{ key: card.id }}
					>
						<PlayingCard
							{card}
							playable={playable.has(card.id)}
							onclick={() => onmove({ type: 'play', card })}
						/>
					</div>
				{/each}
			</div>
		</section>
	</main>
</div>

{#if match.result}
	<div class="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
		<Card.Root class="w-full max-w-sm">
			<Card.Header>
				<Card.Title>{m.match_over()}</Card.Title>
				<Card.Description>{m.team_won({ number: match.result.winner + 1 })}</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<ul class="flex flex-col gap-1 text-sm tabular-nums">
					{#each [0, 1] as const as team (team)}
						<li class="flex justify-between">
							<span>{teamName(team)}</span>
							<span class="font-semibold">{match.result.scores[team]}</span>
						</li>
					{/each}
				</ul>
				{#if dealScore}
					<DealScoreTable score={dealScore} {myTeam} />
				{/if}
				{#if !isOwner}
					<p class="text-sm text-muted-foreground">{m.wait_for_owner()}</p>
				{/if}
				<div class="flex flex-wrap justify-end gap-2">
					<Button variant="outline" onclick={onback}>{m.back_to_room()}</Button>
					{#if isOwner}
						<Button onclick={onplayagain}>{m.play_again()}</Button>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	</div>
{:else if dealScore}
	<div class="fixed inset-x-0 bottom-0 z-10 p-4 md:hidden">
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.deal_score()}</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<DealScoreTable score={dealScore} {myTeam} />
				<Button onclick={ondismissscore}>{m.continue()}</Button>
			</Card.Content>
		</Card.Root>
	</div>
{/if}
