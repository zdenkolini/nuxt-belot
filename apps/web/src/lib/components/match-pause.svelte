<script lang="ts">
	import type { MatchView } from '@belot/server';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { usernameIn } from '#lib/players.js';

	let {
		match,
		onend,
		onback,
	}: {
		match: MatchView;
		onend: () => void;
		onback: () => void;
	} = $props();

	let confirming = $state(false);

	const missing = $derived(
		match.missing.map((userId) => usernameIn(match.players, userId)).join(', '),
	);

	const end = () => {
		confirming = false;
		onend();
	};
</script>

{#if match.ended}
	<div class="fixed inset-0 z-30 flex items-center justify-center bg-[oklch(0.2_0.06_25/0.45)] p-4">
		<Card.Root class="paper w-full max-w-sm rounded-[2px] ring-0">
			<Card.Header>
				<Card.Title class="font-hand text-4xl leading-none">{m.match_ended()}</Card.Title>
				<Card.Description>{m.match_ended_by_players()}</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button onclick={onback}>{m.back_to_room()}</Button>
			</Card.Footer>
		</Card.Root>
	</div>
{:else if match.missing.length > 0}
	<div
		class="paper fixed inset-x-0 top-14 z-20 mx-auto flex w-fit items-center gap-3 px-3 py-2 text-sm"
		role="status"
	>
		<span>{m.waiting_for({ usernames: missing })}</span>
		<Button size="sm" variant="outline" onclick={() => (confirming = true)}>
			{m.end_match()}
		</Button>
	</div>
	<Dialog.Root bind:open={confirming}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>{m.end_match_title()}</Dialog.Title>
				<Dialog.Description>{m.end_match_description()}</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (confirming = false)}>{m.keep_waiting()}</Button>
				<Button variant="destructive" onclick={end}>{m.end_match()}</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
