import { createDb } from '@belot/db';
import { createApp } from '#src/app';

const app = await createApp({
  db: await createDb(process.env.DATA_DIR ?? '.data'),
  // Resend replaces this in production.
  sendEmail: async ({ to, subject, text }) => {
    console.log(`Email to ${to}: ${subject}\n${text}`);
  },
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret:
    process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me-in-production',
  webURL: process.env.WEB_URL ?? 'http://localhost:5173',
  bots: process.env.NODE_ENV !== 'production',
});

app.listen(Number(process.env.PORT ?? 3000));

console.log(`Server listening on ${app.server?.url}`);
