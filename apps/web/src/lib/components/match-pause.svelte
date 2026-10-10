<script lang="ts">
	import type { MatchView } from '@belot/server';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { m } from '#lib/paraglide/messages.js';

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
		match.missing
			.map(
				(userId) =>
					match.players.find((player) => player.id === userId)?.username ?? m.former_player(),
			)
			.join(', '),
	);

	const end = () => {
		confirming = false;
		onend();
	};
</script>

{#if match.ended}
	<div class="fixed inset-0 z-30 flex items-center justify-center bg-background/80 p-4">
		<Card.Root class="w-full max-w-sm">
			<Card.Header>
				<Card.Title>{m.match_ended()}</Card.Title>
				<Card.Description>{m.match_ended_by_players()}</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button onclick={onback}>{m.back_to_room()}</Button>
			</Card.Footer>
		</Card.Root>
	</div>
{:else if match.missing.length > 0}
	<div
		class="fixed inset-x-0 top-12 z-20 mx-auto flex w-fit items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm shadow"
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
