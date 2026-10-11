<script lang="ts">
	// PROTOTYPE variant "letter": the kafana writes to you on its letterhead;
	// every form is a reply slip cut off along the dashed line.
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import Scissors from '@lucide/svelte/icons/scissors';
	import SuitPip from '#lib/components/match/suit-pip.svelte';
	import ClaimForm from '#lib/components/claim-form.svelte';
	import SignOut from '#lib/components/sign-out.svelte';
	import UsernameForm from '#lib/components/username-form.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { VariantProps } from './types';

	let { screen, me, matches, claim, choosing, chooseFailed, onchoose }: VariantProps = $props();
	let typed = $state('');
</script>

{#snippet letterhead()}
	<header class="flex items-center justify-between border-b-2 border-(--ink) pb-2">
		<span class="font-hand text-3xl leading-none font-bold">{m.app_title()}</span>
		<span class="flex gap-1.5" aria-hidden="true">
			{#each ['spades', 'hearts', 'clubs', 'diamonds'] as const as suit (suit)}
				<SuitPip {suit} class="size-3.5 {suit === 'hearts' || suit === 'diamonds' ? 'text-(--card-red)' : 'text-(--card-black)'}" />
			{/each}
		</span>
	</header>
{/snippet}

{#snippet cut()}
	<div class="relative my-5 border-t-2 border-dashed border-(--ink-soft)/50" aria-hidden="true">
		<Scissors class="absolute -top-2.5 left-4 size-4 bg-(--paper) px-0.5 text-(--ink-soft)" />
	</div>
{/snippet}

{#snippet sheet(body: Snippet, tilt = -0.8)}
	<article class="paper w-full max-w-md px-7 pt-6 pb-6" style:rotate="{tilt}deg">
		{@render letterhead()}
		{@render body()}
	</article>
{/snippet}

<main class="table-skin room grid min-h-svh place-items-center px-3 py-10 pb-20 text-(--ink)">
	<div class="flex w-full max-w-3xl flex-col items-center gap-6">
		{#if screen === 'account' && me}
			{#snippet body()}
				<p class="mt-5 font-hand text-3xl leading-none">{m.letter_greeting({ username: me!.username ?? '' })}</p>
				<p class="mt-3 text-sm leading-relaxed">
					{me!.isGuest
						? m.letter_guest_body({ count: matches ?? 0 })
						: m.letter_account_body({ email: me!.email, count: matches ?? 0 })}
				</p>
				<p class="mt-3 text-right font-hand text-2xl leading-none">{m.letter_sign_off()}</p>
				{@render cut()}
				<section class="flex flex-col gap-3">
					<h1 class="text-sm font-semibold">{me!.isGuest ? m.claim_account() : m.change_username()}</h1>
					{#if me!.isGuest}
						<p class="text-xs text-(--ink-soft)">{m.claim_description()}</p>
						<ClaimForm />
					{:else}
						<UsernameForm />
					{/if}
				</section>
			{/snippet}
			{@render sheet(body)}
			<div class="flex w-full max-w-md items-center justify-between">
				<a class="paper px-3 py-1.5 text-sm" href={resolve('/')}>{m.back_home()}</a>
				<div class="paper px-2 py-1"><SignOut isGuest={me.isGuest} /></div>
			</div>
		{:else if screen === 'username'}
			<!-- An envelope you address with your name. -->
			<div
				class="paper relative flex aspect-[16/9] w-full max-w-md -rotate-[1.2deg] items-end overflow-hidden px-8 pb-8"
			>
				<div
					class="absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom_right,transparent_49.5%,oklch(0.25_0.08_25/0.12)_50%,transparent_50.5%),linear-gradient(to_bottom_left,transparent_49.5%,oklch(0.25_0.08_25/0.12)_50%,transparent_50.5%)]"
					aria-hidden="true"
				></div>
				<span
					class={[
						'relative ml-auto w-3/5 border-b border-(--ink-soft)/50 font-hand text-4xl leading-tight break-all',
						!typed && 'text-(--ink-soft)/50',
					]}
				>
					{typed || m.name_placeholder()}
				</span>
			</div>
			<section class="paper flex w-full max-w-md rotate-[0.6deg] flex-col gap-3 px-7 py-5">
				<p class="text-sm">{m.letter_username_body()}</p>
				<UsernameForm bind:username={typed} />
			</section>
		{:else if screen === 'claim' && claim}
			{#snippet body()}
				<p class="mt-5 font-hand text-3xl leading-none">{m.letter_claim_greeting()}</p>
				<p class="mt-3 text-sm leading-relaxed">{m.claim_choice_title()}. {m.claim_choice_description()}</p>
				<p class="mt-3 text-right font-hand text-2xl leading-none">{m.letter_sign_off()}</p>
				{@render cut()}
				<div class="grid gap-3 sm:grid-cols-2">
					{#each [{ choice: 'kept_account', label: m.your_account(), count: claim.accountMatches, action: m.claim_keep_short() }, { choice: 'merged', label: m.this_guest(), count: claim.guestMatches, action: m.claim_merge_short() }] as const as option (option.choice)}
						<button
							type="button"
							disabled={choosing}
							onclick={() => onchoose(option.choice)}
							class="flex flex-col gap-1 rounded-[2px] border border-dashed border-(--ink-soft)/60 px-4 py-3 text-left transition-colors hover:border-(--oxblood) hover:bg-(--muted) focus-visible:outline-2 focus-visible:outline-(--oxblood) disabled:opacity-60"
						>
							<span class="text-xs text-(--ink-soft)">{option.label}</span>
							<span class="font-hand text-4xl leading-none font-bold tabular-nums">{option.count}</span>
							<span class="text-xs text-(--ink-soft)">{m.matches_played()}</span>
							<span class="mt-1 text-sm font-semibold text-(--oxblood)">{option.action}</span>
						</button>
					{/each}
				</div>
				{#if chooseFailed}
					<p class="mt-3 text-sm text-(--oxblood)" role="status">{m.claim_choice_failed()}</p>
				{/if}
			{/snippet}
			{@render sheet(body, 0.6)}
		{/if}
	</div>
</main>
