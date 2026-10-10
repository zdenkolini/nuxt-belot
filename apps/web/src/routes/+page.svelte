<script lang="ts">
	import { api } from '#lib/api.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { m } from '#lib/paraglide/messages.js';

	const health = api.health.get();
</script>

<svelte:head>
	<title>{m.app_title()}</title>
</svelte:head>

<main class="flex min-h-svh items-center justify-center p-4">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>{m.app_title()}</Card.Title>
			<Card.Description>{m.server_health()}</Card.Description>
		</Card.Header>
		<Card.Content>
			{#await health}
				<p>{m.health_checking()}</p>
			{:then { data }}
				<p>{data?.status === 'ok' ? m.health_ok() : m.health_down()}</p>
			{:catch}
				<p>{m.health_down()}</p>
			{/await}
		</Card.Content>
	</Card.Root>
</main>
