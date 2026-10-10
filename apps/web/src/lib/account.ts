import { QueryClient, queryOptions } from '@tanstack/svelte-query';
import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';
import { api, apiURL } from '#lib/api.js';

export const authClient = createAuthClient({
	baseURL: apiURL,
	plugins: [magicLinkClient()],
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
