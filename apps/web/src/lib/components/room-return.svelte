<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { meQuery, queryClient } from '#lib/account.js';
	import { api } from '#lib/api.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { m } from '#lib/paraglide/messages.js';

	// A seated player is always shown the way back to their room: a modal
	// they cannot close while their match runs, else a bar.
	const me = createQuery(() => meQuery);

	const room = $derived(me.data?.room ?? null);
	const roomPath = $derived(room ? resolve('/rooms/[id]', { id: room.id }) : null);
	const inMatch = $derived(!!room?.matchRunning && page.url.pathname !== roomPath);
	const showBar = $derived(!!room && !room.matchRunning && !page.url.pathname.startsWith('/rooms/'));

	let leaving = $state(false);

	// Leaving a running match abandons it.
	const leave = async () => {
		leaving = true;
		await api.rooms({ id: room!.id }).leave.post({});
		await queryClient.invalidateQueries({ queryKey: ['me'] });
		leaving = false;
	};
</script>

<Dialog.Root open={inMatch}>
	<Dialog.Content
		showCloseButton={false}
		escapeKeydownBehavior="ignore"
		interactOutsideBehavior="ignore"
	>
		<Dialog.Header>
			<Dialog.Title>{m.match_waiting_title()}</Dialog.Title>
			<Dialog.Description>{m.match_waiting_description()}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="destructive" onclick={leave} disabled={leaving}>{m.abandon_match()}</Button>
			<Button onclick={() => goto(roomPath!)}>{m.return_to_match()}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

{#if showBar}
	<div
		class="paper fixed inset-x-0 bottom-3 z-20 mx-auto flex w-fit flex-wrap items-center gap-3 px-3 py-2 text-sm"
		role="status"
	>
		<span class="font-semibold">{m.room_of({ owner: room!.owner ?? '' })}</span>
		<span class="text-xs text-(--ink-soft)">{m.seats_filled({ count: room!.seatsFilled })}</span>
		<Button size="sm" href={roomPath}>{m.back_to_room()}</Button>
		<Button size="sm" variant="ghost" onclick={leave} disabled={leaving}>{m.leave_room()}</Button>
	</div>
{/if}
