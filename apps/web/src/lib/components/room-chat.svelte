<script lang="ts">
	import type { ChatIntent, ChatMessage, RoomMessage, RoomView } from '@belot/server';
	import type { api } from '#lib/api.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { m } from '#lib/paraglide/messages.js';

	type RoomSocket = ReturnType<ReturnType<typeof api.rooms>['ws']['subscribe']>;

	let {
		socket,
		members,
		myId,
	}: { socket: RoomSocket; members: RoomView['members']; myId: string | undefined } = $props();

	// The server already leaves out muted players' messages.
	let messages = $state<ChatMessage[]>([]);
	let muted = $state<string[]>([]);
	let text = $state('');

	const send = (intent: ChatIntent) => socket.send(intent);

	$effect(() => {
		let asked = false;
		socket.subscribe(({ data }) => {
			const message = data as RoomMessage;
			// The first room message means the server knows this socket.
			if (message.type === 'room' && !asked) {
				asked = true;
				send({ type: 'chat.history' });
			} else if (message.type === 'chat.message') {
				messages = [...messages, message.message];
			} else if (message.type === 'chat.history') {
				messages = message.messages;
				muted = message.muted;
			}
		});
	});

	const usernameOf = (userId: string) =>
		members.find((member) => member.id === userId)?.username ?? m.former_player();

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		if (!text.trim()) return;
		send({ type: 'chat.send', text });
		text = '';
	};
</script>

<section class="flex flex-col gap-2">
	<h2 class="font-medium">{m.chat()}</h2>
	<ul class="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm" aria-live="polite">
		{#each messages as message (message.id)}
			<li class="flex items-start justify-between gap-2">
				<span><span class="font-medium">{usernameOf(message.from)}:</span> {message.text}</span>
				{#if message.from !== myId}
					<Button
						size="xs"
						variant="ghost"
						onclick={() => send({ type: 'chat.mute', playerId: message.from })}
					>
						{m.mute()}
					</Button>
				{/if}
			</li>
		{:else}
			<li class="text-muted-foreground">{m.no_chat_messages()}</li>
		{/each}
	</ul>
	{#if muted.length}
		<ul class="flex flex-wrap gap-2 text-sm text-muted-foreground">
			{#each muted as playerId (playerId)}
				<li class="flex items-center gap-1">
					{m.muted_player({ username: usernameOf(playerId) })}
					<Button
						size="xs"
						variant="outline"
						onclick={() => send({ type: 'chat.unmute', playerId })}
					>
						{m.unmute()}
					</Button>
				</li>
			{/each}
		</ul>
	{/if}
	<form class="flex gap-2" onsubmit={submit}>
		<Input bind:value={text} maxlength={500} aria-label={m.chat_message()} />
		<Button type="submit" variant="outline">{m.send_message()}</Button>
	</form>
</section>
