<script lang="ts">
  import { authClient, meQuery, queryClient } from '#lib/account';
  import { Button } from '#lib/components/ui/button';
  import { m } from '#lib/paraglide/messages';

  // A guest who signs out loses the account, so they confirm first.
  let { isGuest }: { isGuest: boolean } = $props();
  let confirming = $state(false);

  const signOut = async () => {
    await authClient.signOut();
    await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
  };
</script>

{#if confirming}
  <div class="flex flex-col items-start gap-2">
    <p class="text-sm" role="alert">{m.guest_sign_out_warning()}</p>
    <div class="flex gap-2">
      <Button variant="ghost" size="sm" onclick={() => (confirming = false)}
        >{m.stay_in_match()}</Button
      >
      <Button variant="destructive" size="sm" onclick={signOut}
        >{m.sign_out_anyway()}</Button
      >
    </div>
  </div>
{:else}
  <Button
    variant="ghost"
    size="sm"
    onclick={() => (isGuest ? (confirming = true) : signOut())}
  >
    {m.sign_out()}
  </Button>
{/if}
