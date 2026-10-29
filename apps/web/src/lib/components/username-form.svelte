<script lang="ts">
  import { api } from '#lib/api';
  import { meQuery, queryClient } from '#lib/account';
  import { Button } from '#lib/components/ui/button';
  import { Input } from '#lib/components/ui/input';
  import { Label } from '#lib/components/ui/label';
  import { m } from '#lib/paraglide/messages';

  // Bindable, so a page can show the name as it is typed.
  let { username = $bindable('') }: { username?: string } = $props();
  let message = $state('');
  let failed = $state(false);
  let saving = $state(false);

  const errors: Record<number, () => string> = {
    409: m.username_taken,
    422: m.username_invalid,
    429: m.username_too_soon,
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    saving = true;
    const { error } = await api.me.username.put({ username });
    saving = false;
    failed = !!error;
    message = error
      ? (errors[error.status] ?? m.username_invalid)()
      : m.username_saved();
    if (!error)
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
  };
</script>

<form class="flex flex-col gap-3" onsubmit={submit}>
  <Label for="username">{m.username_label()}</Label>
  <Input
    id="username"
    bind:value={username}
    required
    minlength={3}
    maxlength={20}
    pattern="[A-Za-z0-9_]+"
    aria-invalid={failed}
    aria-describedby="username-hint"
  />
  <p id="username-hint" class="text-sm text-muted-foreground">
    {m.username_hint()}
  </p>
  {#if message}
    <p class={failed ? 'text-sm text-destructive' : 'text-sm'} role="status">
      {message}
    </p>
  {/if}
  <Button type="submit" disabled={saving}>{m.save()}</Button>
</form>
