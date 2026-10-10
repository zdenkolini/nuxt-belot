import { treaty } from '@elysiajs/eden';
import type { App } from '@belot/server';

export const api = treaty<App>(
	import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
);
