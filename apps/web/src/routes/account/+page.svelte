<script lang="ts">
  import { resolve } from '$app/paths';
  import { createQuery } from '@tanstack/svelte-query';
  import { meQuery } from '#lib/account';
  import { api } from '#lib/api';
  import ClaimForm from '#lib/components/claim-form.svelte';
  import KafanaLetter from '#lib/components/kafana-letter.svelte';
  import SignOut from '#lib/components/sign-out.svelte';
  import UsernameForm from '#lib/components/username-form.svelte';
  import { m } from '#lib/paraglide/messages';

  const me = createQuery(() => meQuery);
  const matches = createQuery(() => ({
    queryKey: ['me', 'matches'],
    queryFn: async () => {
      const { data, error } = await api.me.matches.get();
      if (error) throw error;
      return data;
    },
  }));
</script>

<svelte:head>
  <title>{m.account_title()} · {m.app_title()}</title>
</svelte:head>

<main
  class="table-skin room grid min-h-svh place-items-center px-3 py-10 text-(--ink)"
>
  {#if me.data}
    {@const count = matches.data?.length ?? 0}
    <div class="flex w-full max-w-md flex-col gap-6">
      <KafanaLetter
        greeting={m.letter_greeting({ username: me.data.username ?? '' })}
      >
        {me.data.isGuest
          ? m.letter_guest_body({ count })
          : m.letter_account_body({ email: me.data.email, count })}
        {#snippet reply()}
          <section class="flex flex-col gap-3">
            <h1 class="text-sm font-semibold">
              {me.data!.isGuest ? m.claim_account() : m.change_username()}
            </h1>
            {#if me.data!.isGuest}
              <p class="text-xs text-(--ink-soft)">{m.claim_description()}</p>
              <ClaimForm seated={!!me.data!.room} />
            {:else}
              <UsernameForm />
            {/if}
          </section>
        {/snippet}
      </KafanaLetter>
      <div class="flex items-center justify-between">
        <a class="paper px-3 py-1.5 text-sm" href={resolve('/')}
          >{m.back_home()}</a
        >
        <div class="paper px-2 py-1"><SignOut isGuest={me.data.isGuest} /></div>
      </div>
    </div>
  {/if}
</main>
