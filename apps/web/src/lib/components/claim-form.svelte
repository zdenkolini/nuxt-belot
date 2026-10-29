<script lang="ts">
	import { authClient, queryClient } from '#lib/account.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { m } from '#lib/paraglide/messages.js';

	// A guest claims their account: the magic link goes to the email. A seated
	// guest confirms first, as the claim takes them out of their room.
	let { submitLabel = m.send_link(), seated = false }: { submitLabel?: string; seated?: boolean } =
		$props();

	let email = $state('');
	let claim = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');
	let confirming = $state(false);

	const send = async () => {
		confirming = false;
		claim = 'sending';
		const { error } = await authClient.signIn.magicLink({
			email,
			callbackURL: `${location.origin}/`,
		});
		claim = error ? 'failed' : 'sent';
		queryClient.invalidateQueries({ queryKey: ['me'], exact: true });
	};

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		if (seated) confirming = true;
		else send();
	};
</script>

{#if claim === 'sent'}
	<p role="status">{m.claim_link_sent()}</p>
{:else}
	<form class="flex flex-col gap-3" onsubmit={submit}>
		<Label for="email">{m.email_label()}</Label>
		<Input id="email" type="email" autocomplete="email" bind:value={email} required />
		{#if claim === 'failed'}
			<p class="text-sm text-(--oxblood)" role="status">{m.sign_in_failed()}</p>
		{/if}
		<Button type="submit" disabled={claim === 'sending'}>{submitLabel}</Button>
	</form>
{/if}

<Dialog.Root bind:open={confirming}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.claim_leaves_room_title()}</Dialog.Title>
			<Dialog.Description>{m.claim_leaves_room_description()}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (confirming = false)}>{m.keep_seat()}</Button>
			<Button variant="destructive" onclick={send}>{m.claim_and_leave()}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
