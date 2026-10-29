<script lang="ts">
  import { authClient, meQuery, queryClient } from '#lib/account';
  import { Button } from '#lib/components/ui/button';
  import * as Card from '#lib/components/ui/card';
  import { Input } from '#lib/components/ui/input';
  import { Label } from '#lib/components/ui/label';
  import { m } from '#lib/paraglide/messages';

  let email = $state('');
  let status = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  let guestFailed = $state(false);

  const playAsGuest = async () => {
    const { error } = await authClient.signIn.anonymous();
    guestFailed = !!error;
    if (!error)
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    status = 'sending';
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: `${location.origin}/`,
    });
    status = error ? 'failed' : 'sent';
  };
</script>

<svelte:head>
  <title>{m.sign_in_title()} · {m.app_title()}</title>
</svelte:head>

<main class="flex min-h-svh items-center justify-center p-4">
  <Card.Root class="w-full max-w-sm">
    <Card.Header>
      <Card.Title>{m.sign_in_title()}</Card.Title>
      <Card.Description>{m.sign_in_description()}</Card.Description>
    </Card.Header>
    <Card.Content>
      {#if status === 'sent'}
        <p role="status">{m.link_sent()}</p>
      {:else}
        <form class="flex flex-col gap-3" onsubmit={submit}>
          <Label for="email">{m.email_label()}</Label>
          <Input
            id="email"
            type="email"
            autocomplete="email"
            bind:value={email}
            required
          />
          {#if status === 'failed'}
            <p class="text-sm text-destructive" role="status">
              {m.sign_in_failed()}
            </p>
          {/if}
          <Button type="submit" disabled={status === 'sending'}
            >{m.send_link()}</Button
          >
        </form>
        <Button variant="outline" class="mt-3 w-full" onclick={playAsGuest}
          >{m.play_as_guest()}</Button
        >
        {#if guestFailed}
          <p class="mt-2 text-sm text-destructive" role="status">
            {m.guest_sign_in_failed()}
          </p>
        {/if}
      {/if}
    </Card.Content>
  </Card.Root>
</main>
