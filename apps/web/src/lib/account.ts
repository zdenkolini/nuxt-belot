import { QueryClient, queryOptions } from '@tanstack/svelte-query';
import { createAuthClient } from 'better-auth/client';
import { anonymousClient, magicLinkClient } from 'better-auth/client/plugins';
import { api, apiURL } from '#lib/api.js';

export const authClient = createAuthClient({
	baseURL: apiURL,
	plugins: [magicLinkClient(), anonymousClient()],
});

export const queryClient = new QueryClient();

// Null when signed out.
export const meQuery = queryOptions({
	queryKey: ['me'],
	queryFn: async () => {
		const { data, error } = await api.me.get();
		if (error?.status === 401) return null;
		if (error) throw error;
		return data;
	},
});

// A claim into an existing account that waits for the player's choice.
export const claimQuery = queryOptions({
	queryKey: ['claim'],
	queryFn: async () => {
		const { data, error } = await api.me.claim.get();
		if (error) throw error;
		return data.claim;
	},
});
