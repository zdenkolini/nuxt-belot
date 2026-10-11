<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { meQuery } from '#lib/account.js';
	import Variants from '#lib/components/account-prototype/variants.svelte';
	import { m } from '#lib/paraglide/messages.js';

	const me = createQuery(() => meQuery);
</script>

<svelte:head>
	<title>{m.username_title()} · {m.app_title()}</title>
</svelte:head>

<Variants
	screen="username"
	demoLabel="demo (stay here)"
	me={me.data ?? null}
	matches={null}
	claim={null}
	choosing={false}
	chooseFailed={false}
	onchoose={() => {}}
/>
