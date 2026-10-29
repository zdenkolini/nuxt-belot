import { t } from 'elysia';
import { errorBody } from '#src/plugins/errors';

export const usernameBody = t.Object({
  username: t.String({
    minLength: 3,
    maxLength: 20,
    pattern: '^[A-Za-z0-9_]+$',
  }),
});

export const usernameResponse = {
  200: t.Object({ username: t.String() }),
  403: errorBody('guest_cannot_rename'),
  409: errorBody('username_taken'),
  429: errorBody('username_change_too_soon'),
};

export const claimBody = t.Object({
  choice: t.Union([t.Literal('kept_account'), t.Literal('merged')]),
});
