import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';

export const app = new Elysia()
  .use(cors())
  .get('/health', () => ({ status: 'ok' as const }));

export type App = typeof app;
