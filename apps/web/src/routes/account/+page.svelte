<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { authClient, meQuery, queryClient } from '#lib/account.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import UsernameForm from '#lib/components/username-form.svelte';
	import { m } from '#lib/paraglide/messages.js';

	const me = createQuery(() => meQuery);

	// A guest who signs out loses the account, so they confirm first.
	let confirmingSignOut = $state(false);

	const signOut = async () => {
		await authClient.signOut();
		await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
	};

	let email = $state('');
	let claim = $state<'idle' | 'sending' | 'sent' | 'in_room' | 'failed'>('idle');
	// The room that blocks the claim, so the guest can go finish there.
	let blockingRoom = $state<string | null>(null);

	const sendClaimLink = async (event: SubmitEvent) => {
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

<svelte:head>
	<title>{m.account_title()} · {m.app_title()}</title>
</svelte:head>

<main class="flex min-h-svh items-center justify-center p-4">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>{m.account_title()}</Card.Title>
		</Card.Header>
		{#if me.data}
			<Card.Content class="flex flex-col gap-6">
				<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
					<dt class="text-muted-foreground">{m.username_label()}</dt>
					<dd>{me.data.username}</dd>
					{#if !me.data.isGuest}
						<dt class="text-muted-foreground">{m.email_label()}</dt>
						<dd>{me.data.email}</dd>
					{/if}
				</dl>
				{#if me.data.isGuest}
					<section class="flex flex-col gap-3">
						<h2 class="font-medium">{m.claim_account()}</h2>
						<p class="text-sm text-muted-foreground">{m.claim_description()}</p>
						{#if claim === 'sent'}
							<p role="status">{m.claim_link_sent()}</p>
						{:else}
							<form class="flex flex-col gap-3" onsubmit={sendClaimLink}>
								<Label for="email">{m.email_label()}</Label>
								<Input id="email" type="email" autocomplete="email" bind:value={email} required />
								{#if claim === 'in_room' || claim === 'failed'}
									<p class="text-sm text-destructive" role="status">
										{claim === 'in_room' ? m.guest_in_room() : m.sign_in_failed()}
									</p>
								{/if}
								{#if claim === 'in_room' && blockingRoom}
									<Button variant="outline" href={resolve('/rooms/[id]', { id: blockingRoom })}>
										{m.go_to_room()}
									</Button>
								{/if}
								<Button type="submit" disabled={claim === 'sending'}>{m.send_link()}</Button>
							</form>
						{/if}
					</section>
				{:else}
					<section class="flex flex-col gap-3">
						<h2 class="font-medium">{m.change_username()}</h2>
						<UsernameForm />
					</section>
				{/if}
			</Card.Content>
			<Card.Footer class="flex flex-col items-start gap-3">
				{#if confirmingSignOut}
					<p class="text-sm" role="alert">{m.guest_sign_out_warning()}</p>
					<Button variant="destructive" onclick={signOut}>{m.sign_out_anyway()}</Button>
				{:else}
					<Button
						variant="outline"
						onclick={() => (me.data?.isGuest ? (confirmingSignOut = true) : signOut())}
					>
						{m.sign_out()}
					</Button>
				{/if}
			</Card.Footer>
		{/if}
	</Card.Root>
</main>
