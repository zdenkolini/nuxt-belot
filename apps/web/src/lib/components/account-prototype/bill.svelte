<script lang="ts">
	// PROTOTYPE variant "bill": the account is a kafana bill on a wooden tray.
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import SuitPip from '#lib/components/match/suit-pip.svelte';
	import ClaimForm from '#lib/components/claim-form.svelte';
	import SignOut from '#lib/components/sign-out.svelte';
	import UsernameForm from '#lib/components/username-form.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { VariantProps } from './types';

	let { screen, me, matches, claim, choosing, chooseFailed, onchoose }: VariantProps = $props();
	let typed = $state('');
</script>

<!-- A printed bill: header, dotted lines, a torn bottom edge. -->
{#snippet bill(content: Snippet, tilt = -1)}
	<div
		class="paper w-full max-w-80 px-6 pt-6 pb-9 [mask:radial-gradient(circle_at_50%_100%,transparent_5px,#000_5.5px)_0_100%/14px_100%_repeat-x,linear-gradient(#000,#000)_0_0/100%_calc(100%-6px)_no-repeat]"
		style:rotate="{tilt}deg"
	>
		<header class="flex flex-col items-center gap-1 border-b border-dashed border-(--ink-soft)/60 pb-3">
			<span class="flex gap-1.5 text-(--ink)" aria-hidden="true">
				{#each ['spades', 'hearts', 'clubs', 'diamonds'] as const as suit (suit)}
					<SuitPip {suit} class="size-3" />
				{/each}
			</span>
			<span class="font-hand text-3xl leading-none font-bold">{m.app_title()}</span>
		</header>
		{@render content()}
	</div>
{/snippet}

{#snippet line(label: string, value: string | number)}
	<span class="flex items-baseline gap-2 text-sm">
		<span class="text-(--ink-soft)">{label}</span>
		<span class="mb-1 flex-1 border-b-2 border-dotted border-(--ink-soft)/40" aria-hidden="true"></span>
		<span class="font-semibold tabular-nums">{value}</span>
	</span>
{/snippet}

<main class="table-skin room grid min-h-svh place-items-center px-3 py-10 pb-20 text-(--ink)">
	<div class="flex w-full max-w-3xl flex-col items-center gap-6">
		{#if screen === 'account' && me}
			<div class="w-full max-w-96 rounded-[10px] bg-(--chair) p-5 shadow-[inset_0_0_0_3px_var(--chair-dark),0_14px_24px_-8px_oklch(0.1_0.02_40/0.7)]">
				{#snippet content()}
					<div class="flex flex-col gap-2 py-4">
						{@render line(m.username_label(), me!.username ?? '')}
						{#if !me!.isGuest}{@render line(m.email_label(), me!.email)}{/if}
						{@render line(m.matches_played(), matches ?? '–')}
					</div>
					<section class="flex flex-col gap-3 border-t-2 border-(--ink) pt-4">
						<h1 class="text-sm font-semibold">{me!.isGuest ? m.claim_account() : m.change_username()}</h1>
						{#if me!.isGuest}
							<p class="text-xs text-(--ink-soft)">{m.claim_description()}</p>
							<ClaimForm />
						{:else}
							<UsernameForm />
						{/if}
					</section>
				{/snippet}
				{@render bill(content)}
			</div>
			<div class="flex w-full max-w-96 items-center justify-between">
				<a class="paper px-3 py-1.5 text-sm" href={resolve('/')}>{m.back_home()}</a>
				<div class="paper px-2 py-1">{#if me}<SignOut isGuest={me.isGuest} />{/if}</div>
			</div>
		{:else if screen === 'username'}
			{#snippet content()}
				<div class="flex flex-col gap-1 py-5">
					<span class="text-xs text-(--ink-soft)">{m.username_label()}</span>
					<span
						class={[
							'min-h-12 border-b-2 border-dotted border-(--ink-soft)/50 font-hand text-5xl leading-tight',
							!typed && 'text-(--ink-soft)/50',
						]}
					>
						{typed || m.name_placeholder()}
					</span>
				</div>
				<p class="mb-3 text-xs text-(--ink-soft)">{m.username_description()}</p>
				<UsernameForm bind:username={typed} />
			{/snippet}
			{@render bill(content, 1)}
		{:else if screen === 'claim' && claim}
			<h1 class="paper -rotate-[0.6deg] px-4 py-2 text-center">
				<span class="block font-hand text-3xl leading-none font-bold">{m.claim_choice_title()}</span>
				<span class="text-xs text-(--ink-soft)">{m.claim_choice_description()}</span>
			</h1>
			<div class="grid w-full gap-6 sm:grid-cols-2">
				{#each [{ choice: 'kept_account', title: m.your_account(), count: claim.accountMatches, action: m.claim_keep_short(), tilt: -1.2 }, { choice: 'merged', title: m.this_guest(), count: claim.guestMatches, action: m.claim_merge_short(), tilt: 1 }] as const as option (option.choice)}
					<button
						type="button"
						disabled={choosing}
						onclick={() => onchoose(option.choice)}
						class="group justify-self-center rounded-[2px] text-left transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--oxblood) disabled:opacity-60"
					>
						{#snippet content()}
							<div class="flex flex-col gap-2 py-4">
								<span class="text-sm font-semibold">{option.title}</span>
								{@render line(m.matches_played(), option.count)}
							</div>
							<span class="flex items-baseline justify-between border-t-2 border-(--ink) pt-3">
								<span class="text-sm font-semibold">{option.action}</span>
								<span class="font-hand text-4xl leading-none font-bold tabular-nums group-hover:text-(--oxblood)">
									{option.count}
								</span>
							</span>
						{/snippet}
						{@render bill(content, option.tilt)}
					</button>
				{/each}
			</div>
			{#if chooseFailed}
				<p class="paper px-3 py-1.5 text-sm text-(--oxblood)" role="status">{m.claim_choice_failed()}</p>
			{/if}
		{/if}
	</div>
</main>
