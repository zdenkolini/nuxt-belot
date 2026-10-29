<script lang="ts">
  import UsernameForm from '#lib/components/username-form.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let typed = $state('');
</script>

<svelte:head>
  <title>{m.username_title()} · {m.app_title()}</title>
</svelte:head>

<main
  class="table-skin room grid min-h-svh place-items-center px-3 py-10 text-(--ink)"
>
  <div class="flex w-full max-w-md flex-col gap-6">
    <!-- An envelope: the name is written on it as it is typed. -->
    <div
      class="paper relative flex aspect-[16/9] w-full -rotate-[1.2deg] items-end overflow-hidden px-8 pb-8"
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
        aria-hidden="true"
      >
        {typed || m.name_placeholder()}
      </span>
    </div>
    <section class="paper flex rotate-[0.6deg] flex-col gap-3 px-7 py-5">
      <h1 class="font-hand text-3xl leading-none font-bold">
        {m.username_title()}
      </h1>
      <p class="text-sm">{m.letter_username_body()}</p>
      <p class="text-xs text-(--ink-soft)">{m.username_description()}</p>
      <UsernameForm bind:username={typed} />
    </section>
  </div>
</main>
