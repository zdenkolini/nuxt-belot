import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import * as schema from '@belot/db';
import type { Db } from '@belot/db';

export type Email = { to: string; subject: string; text: string };

export type AuthOptions = {
  db: Db;
  sendEmail: (email: Email) => Promise<void>;
  baseURL: string;
  secret: string;
  webURL: string;
};

export const createAuth = ({
  db,
  sendEmail,
  baseURL,
  secret,
  webURL,
}: AuthOptions) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    baseURL,
    secret,
    trustedOrigins: [webURL],
    telemetry: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 365 },
    plugins: [
      magicLink({
        sendMagicLink: ({ email, url }) =>
          sendEmail({
            to: email,
            subject: 'Sign in to Belot',
            text: `Open this link to sign in: ${url}`,
          }),
      }),
    ],
  });
