import { treaty } from '@elysiajs/eden';
import type { App } from '@belot/server';

export const apiURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// The session cookie lives on the server origin, so send it cross-origin.
export const api = treaty<App>(apiURL, { fetch: { credentials: 'include' } });

export type RoomSocket = ReturnType<
  ReturnType<typeof api.rooms>['ws']['subscribe']
>;
