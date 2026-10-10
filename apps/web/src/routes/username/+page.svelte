<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import UsernameForm from '#lib/components/username-form.svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.username_title()} · {m.app_title()}</title>
</svelte:head>

<main class="flex min-h-svh items-center justify-center p-4">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>{m.username_title()}</Card.Title>
			<Card.Description>{m.username_description()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<UsernameForm />
		</Card.Content>
	</Card.Root>
</main>
