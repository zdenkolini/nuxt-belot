<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { api } from '#lib/api.js';
	import { claimQuery, queryClient } from '#lib/account.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { m } from '#lib/paraglide/messages.js';

	const claim = createQuery(() => claimQuery);
	let saving = $state(false);
	let failed = $state(false);

	const choose = async (choice: 'kept_account' | 'merged') => {
		saving = true;
		const { error } = await api.me.claim.post({ choice });
		saving = false;
		failed = !!error;
		if (!error) await queryClient.invalidateQueries({ queryKey: claimQuery.queryKey });
	};
</script>

<svelte:head>
	<title>{m.claim_choice_title()} · {m.app_title()}</title>
</svelte:head>

<main class="flex min-h-svh items-center justify-center p-4">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>{m.claim_choice_title()}</Card.Title>
			<Card.Description>{m.claim_choice_description()}</Card.Description>
		</Card.Header>
		{#if claim.data}
			<Card.Content class="flex flex-col gap-3">
				<Button disabled={saving} onclick={() => choose('kept_account')}>
					{m.claim_keep_account({ count: claim.data.accountMatches })}
				</Button>
				<Button variant="outline" disabled={saving} onclick={() => choose('merged')}>
					{m.claim_merge({ count: claim.data.guestMatches })}
				</Button>
				{#if failed}
					<p class="text-sm text-destructive" role="status">{m.claim_choice_failed()}</p>
				{/if}
			</Card.Content>
		{/if}
	</Card.Root>
</main>
