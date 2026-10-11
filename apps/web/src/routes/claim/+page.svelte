<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { api } from '#lib/api.js';
	import { claimQuery, queryClient } from '#lib/account.js';
	import KafanaLetter from '#lib/components/kafana-letter.svelte';
	import { m } from '#lib/paraglide/messages.js';

	const claim = createQuery(() => claimQuery);
	let choosing = $state(false);
	let failed = $state(false);

	const choose = async (choice: 'kept_account' | 'merged') => {
		choosing = true;
		const { error } = await api.me.claim.post({ choice });
		choosing = false;
		failed = !!error;
		if (!error) await queryClient.invalidateQueries({ queryKey: claimQuery.queryKey });
	};
</script>

<svelte:head>
	<title>{m.claim_choice_title()} · {m.app_title()}</title>
</svelte:head>

<main class="table-skin room grid min-h-svh place-items-center px-3 py-10 text-(--ink)">
	{#if claim.data}
		{@const options = [
			{ choice: 'kept_account', label: m.your_account(), count: claim.data.accountMatches, action: m.claim_keep_short() },
			{ choice: 'merged', label: m.this_guest(), count: claim.data.guestMatches, action: m.claim_merge_short() },
		] as const}
		<KafanaLetter greeting={m.letter_claim_greeting()} tilt={0.6}>
			<h1 class="inline font-semibold">{m.claim_choice_title()}.</h1>
			{m.claim_choice_description()}
			{#snippet reply()}
				<div class="grid gap-3 sm:grid-cols-2">
					{#each options as option (option.choice)}
						<button
							type="button"
							disabled={choosing}
							onclick={() => choose(option.choice)}
							class="flex flex-col gap-1 rounded-[2px] border border-dashed border-(--ink-soft)/60 px-4 py-3 text-left transition-colors hover:border-(--oxblood) hover:bg-(--muted) focus-visible:outline-2 focus-visible:outline-(--oxblood) disabled:opacity-60"
						>
							<span class="text-xs text-(--ink-soft)">{option.label}</span>
							<span class="font-hand text-4xl leading-none font-bold tabular-nums">{option.count}</span>
							<span class="text-xs text-(--ink-soft)">{m.matches_played()}</span>
							<span class="mt-1 text-sm font-semibold text-(--oxblood)">{option.action}</span>
						</button>
					{/each}
				</div>
				{#if failed}
					<p class="mt-3 text-sm text-(--oxblood)" role="status">{m.claim_choice_failed()}</p>
				{/if}
			{/snippet}
		</KafanaLetter>
	{/if}
</main>
