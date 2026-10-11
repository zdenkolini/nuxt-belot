<script lang="ts">
	import { resolve } from '$app/paths';
	import { authClient } from '#lib/account.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { m } from '#lib/paraglide/messages.js';

	// A guest claims their account: the magic link goes to the email.
	let { submitLabel = m.send_link() }: { submitLabel?: string } = $props();

	let email = $state('');
	let claim = $state<'idle' | 'sending' | 'sent' | 'in_room' | 'failed'>('idle');
	// The room that blocks the claim, so the guest can go finish there.
	let blockingRoom = $state<string | null>(null);

	const send = async (event: SubmitEvent) => {
		event.preventDefault();
		claim = 'sending';
		const { error } = await authClient.signIn.magicLink({
			email,
			callbackURL: `${location.origin}/`,
		});
		claim = !error ? 'sent' : error.code === 'GUEST_IN_ROOM' ? 'in_room' : 'failed';
		blockingRoom = (error as { roomId?: string } | null)?.roomId ?? null;
	};
</script>

{#if claim === 'sent'}
	<p role="status">{m.claim_link_sent()}</p>
{:else}
	<form class="flex flex-col gap-3" onsubmit={send}>
		<Label for="email">{m.email_label()}</Label>
		<Input id="email" type="email" autocomplete="email" bind:value={email} required />
		{#if claim === 'in_room' || claim === 'failed'}
			<p class="text-sm text-(--oxblood)" role="status">
				{claim === 'in_room' ? m.guest_in_room() : m.sign_in_failed()}
			</p>
		{/if}
		{#if claim === 'in_room' && blockingRoom}
			<Button variant="outline" href={resolve('/rooms/[id]', { id: blockingRoom })}>
				{m.go_to_room()}
			</Button>
		{/if}
		<Button type="submit" disabled={claim === 'sending'}>{submitLabel}</Button>
	</form>
{/if}
