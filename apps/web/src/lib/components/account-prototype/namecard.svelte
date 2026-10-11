<script lang="ts">
	// PROTOTYPE variant "namecard": the folded name card from the table seats,
	// large, with your name on it; details and forms on a sheet below.
	import { resolve } from '$app/paths';
	import ClaimForm from '#lib/components/claim-form.svelte';
	import SignOut from '#lib/components/sign-out.svelte';
	import UsernameForm from '#lib/components/username-form.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { VariantProps } from './types';

	let { screen, me, matches, claim, choosing, chooseFailed, onchoose }: VariantProps = $props();
	let typed = $state('');
</script>

<!-- A tent card: the front face, shaded toward the fold at the top. -->
{#snippet card(name: string, faded: boolean, label?: string, tilt = -1.5)}
	<div class="relative w-full max-w-80" style:rotate="{tilt}deg">
		<div
			class="paper h-3 rounded-b-none bg-[linear-gradient(oklch(0.25_0.08_25/0.16),transparent)] [transform:perspective(400px)_rotateX(55deg)] origin-bottom"
			aria-hidden="true"
		></div>
		<div class="paper flex min-h-28 flex-col items-center justify-center rounded-t-none px-5 pt-3 pb-4 text-center">
			{#if label}<span class="text-xs text-(--ink-soft)">{label}</span>{/if}
			<span class={['font-hand text-5xl leading-tight font-bold break-all', faded && 'text-(--ink-soft)/50']}>
				{name}
			</span>
		</div>
	</div>
{/snippet}

<main class="table-skin room grid min-h-svh place-items-center px-3 py-10 pb-20 text-(--ink)">
	<div class="flex w-full max-w-3xl flex-col items-center gap-6">
		{#if screen === 'account' && me}
			{@render card(me.username ?? '', false, me.isGuest ? m.guest_label() : undefined)}
			<section class="paper flex w-full max-w-96 rotate-[0.6deg] flex-col gap-5 px-6 py-5">
				<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
					{#if !me.isGuest}
						<dt class="text-(--ink-soft)">{m.email_label()}</dt>
						<dd class="truncate">{me.email}</dd>
					{/if}
					<dt class="text-(--ink-soft)">{m.matches_played()}</dt>
					<dd class="font-hand text-2xl leading-6 tabular-nums">{matches ?? '–'}</dd>
				</dl>
				<div class="flex flex-col gap-3 border-t border-(--paper-rule) pt-4">
					<h1 class="text-sm font-semibold">{me.isGuest ? m.claim_account() : m.change_username()}</h1>
					{#if me.isGuest}
						<p class="text-xs text-(--ink-soft)">{m.claim_description()}</p>
						<ClaimForm />
					{:else}
						<UsernameForm />
					{/if}
				</div>
				<div class="flex items-center justify-between border-t border-(--paper-rule) pt-3">
					<a class="text-sm underline underline-offset-2" href={resolve('/')}>{m.back_home()}</a>
					<SignOut isGuest={me.isGuest} />
				</div>
			</section>
		{:else if screen === 'username'}
			{@render card(typed || m.name_placeholder(), !typed)}
			<section class="paper flex w-full max-w-96 rotate-[0.5deg] flex-col gap-3 px-6 py-5">
				<h1 class="font-hand text-3xl leading-none font-bold">{m.username_title()}</h1>
				<p class="text-xs text-(--ink-soft)">{m.username_description()}</p>
				<UsernameForm bind:username={typed} />
			</section>
		{:else if screen === 'claim' && claim}
			<h1 class="paper -rotate-[0.6deg] px-4 py-2 text-center">
				<span class="block font-hand text-3xl leading-none font-bold">{m.claim_choice_title()}</span>
				<span class="text-xs text-(--ink-soft)">{m.claim_choice_description()}</span>
			</h1>
			<div class="grid w-full gap-8 sm:grid-cols-2">
				{#each [{ choice: 'kept_account', title: me?.username ?? m.your_account(), label: m.your_account(), count: claim.accountMatches, action: m.claim_keep_account({ count: claim.accountMatches }), tilt: -1.5 }, { choice: 'merged', title: m.guest_label(), label: m.this_guest(), count: claim.guestMatches, action: m.claim_merge({ count: claim.guestMatches }), tilt: 1.2 }] as const as option (option.choice)}
					<button
						type="button"
						disabled={choosing}
						onclick={() => onchoose(option.choice)}
						class="group flex flex-col items-center gap-3 rounded-[2px] transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--oxblood) disabled:opacity-60"
					>
						{@render card(option.title, false, option.label, option.tilt)}
						<span class="paper px-3 py-1.5 text-sm font-semibold group-hover:text-(--oxblood)">{option.action}</span>
					</button>
				{/each}
			</div>
			{#if chooseFailed}
				<p class="paper px-3 py-1.5 text-sm text-(--oxblood)" role="status">{m.claim_choice_failed()}</p>
			{/if}
		{/if}
	</div>
</main>
