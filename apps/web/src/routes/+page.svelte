<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { createQuery } from '@tanstack/svelte-query';
  import { meQuery } from '#lib/account';
  import { api } from '#lib/api';
  import RoomMenu from '#lib/components/room-menu.svelte';
  import SuitPip from '#lib/components/match/suit-pip.svelte';
  import { Button } from '#lib/components/ui/button';
  import { m } from '#lib/paraglide/messages';

  const me = createQuery(() => meQuery);
  const publicRooms = createQuery(() => ({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data, error } = await api.rooms.get();
      if (error) throw error;
      return data;
    },
    refetchInterval: 10_000,
  }));

  // Home is the closed menu; opened, the left page is the house menu and the
  // right page lists the public rooms.
  let open = $state(false);
  let creating = $state(false);

  const createRoom = async () => {
    creating = true;
    const { data } = await api.rooms.post({});
    creating = false;
    if (data) goto(resolve('/rooms/[id]', { id: data.id }));
  };
</script>

<svelte:head>
  <title>{m.app_title()}</title>
</svelte:head>

<main
  class="table-skin room grid min-h-svh place-items-center px-3 py-8 text-(--ink) md:px-8"
>
  {#if !open}
    <button
      type="button"
      onclick={() => (open = true)}
      aria-label={m.open_menu()}
      class="group relative flex aspect-[3/4] w-72 -rotate-[1.5deg] flex-col items-center justify-center gap-5 rounded-[3px] bg-(--oxblood) text-(--card-face) shadow-[0_2px_2px_oklch(0.25_0.08_25/0.3),0_24px_40px_-12px_oklch(0.1_0.05_25/0.7)] transition-transform duration-300 ease-out hover:-translate-y-1 hover:rotate-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--card-face) md:w-80"
    >
      <span
        class="absolute inset-3 rounded-[2px] border border-(--card-face)/35"
        aria-hidden="true"
      ></span>
      <span class="flex gap-2" aria-hidden="true">
        {#each ['spades', 'hearts', 'clubs', 'diamonds'] as const as suit (suit)}
          <SuitPip {suit} class="size-5" />
        {/each}
      </span>
      <span class="font-hand text-7xl leading-none font-bold"
        >{m.app_title()}</span
      >
      <span
        class="absolute bottom-8 text-xs text-(--card-face)/75 group-hover:text-(--card-face)"
      >
        {m.open_menu()}
      </span>
    </button>
  {:else}
    <div
      class="grid w-full max-w-5xl gap-4 md:grid-cols-[18rem_1fr] md:gap-0"
      in:fly={{ y: 24, duration: 350, easing: cubicOut }}
    >
      <nav
        class="paper flex flex-col gap-3 px-6 py-6 md:rounded-r-none md:shadow-[inset_-18px_0_24px_-20px_oklch(0.25_0.08_25/0.35),0_1px_1px_oklch(0.25_0.08_25/0.18),0_8px_18px_-6px_oklch(0.25_0.08_25/0.45)]"
      >
        <span class="font-hand text-4xl leading-none font-bold"
          >{m.app_title()}</span
        >
        <Button onclick={createRoom} disabled={creating}
          >{m.create_room()}</Button
        >
        <ul class="flex flex-col text-sm">
          {#each [m.ranked_queue(), m.leaderboard()] as label (label)}
            <li
              class="flex items-baseline justify-between border-b border-(--paper-rule) py-1.5 text-(--ink-soft)"
            >
              {label}<span class="text-xs">{m.coming_soon()}</span>
            </li>
          {/each}
          {#if me.data?.username}
            <li class="flex items-baseline justify-between py-1.5">
              <span class="font-semibold">{me.data.username}</span>
              <a
                class="text-xs underline underline-offset-2"
                href={resolve('/account')}
              >
                {me.data.isGuest ? m.claim_account() : m.account_link()}
              </a>
            </li>
          {/if}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          class="mt-auto self-start"
          onclick={() => (open = false)}
        >
          {m.close_menu()}
        </Button>
      </nav>
      <div class="paper px-6 py-6 md:rounded-l-none">
        <RoomMenu
          rooms={publicRooms.data ?? []}
          loaded={publicRooms.isSuccess}
        />
      </div>
    </div>
  {/if}
</main>
