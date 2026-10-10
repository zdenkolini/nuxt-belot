<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { authClient, meQuery, queryClient } from '#lib/account.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import UsernameForm from '#lib/components/username-form.svelte';
	import { m } from '#lib/paraglide/messages.js';

	const me = createQuery(() => meQuery);

	const signOut = async () => {
		await authClient.signOut();
		await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
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
					<dt class="text-muted-foreground">{m.email_label()}</dt>
					<dd>{me.data.email}</dd>
				</dl>
				<section class="flex flex-col gap-3">
					<h2 class="font-medium">{m.change_username()}</h2>
					<UsernameForm />
				</section>
			</Card.Content>
			<Card.Footer>
				<Button variant="outline" onclick={signOut}>{m.sign_out()}</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
</main>
