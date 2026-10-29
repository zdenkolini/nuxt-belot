import { Elysia, t } from 'elysia';

type ErrorStatus = 403 | 404 | 409 | 429;

export class HttpError<const Code extends string = string> extends Error {
  constructor(
    readonly status: ErrorStatus,
    readonly code: Code,
  ) {
    super(code);
  }
}

export class Forbidden<const Code extends string> extends HttpError<Code> {
  constructor(code: Code) {
    super(403, code);
  }
}

export class NotFound<const Code extends string> extends HttpError<Code> {
  constructor(code: Code) {
    super(404, code);
  }
}

export class Conflict<const Code extends string> extends HttpError<Code> {
  constructor(code: Code) {
    super(409, code);
  }
}

export class TooManyRequests<
  const Code extends string,
> extends HttpError<Code> {
  constructor(code: Code) {
    super(429, code);
  }
}

export const errorBody = <const Code extends string>(code: Code) =>
  t.Object({ error: t.Literal(code) });

// Elysia's own errors and a thrown `status()` keep their responses: routes
// not yet moved to typed errors, and the web side, rely on them.
const elysiaCodes = new Set<unknown>([
  'VALIDATION',
  'NOT_FOUND',
  'PARSE',
  'INVALID_COOKIE_SIGNATURE',
  'INVALID_FILE_TYPE',
]);

export const errors = new Elysia({ name: 'errors' }).onError(
  { as: 'global' },
  ({ code, error, status }) => {
    if (error instanceof HttpError) {
      return status(error.status, { error: error.code });
    }
    if (typeof code === 'number' || elysiaCodes.has(code)) return;
    console.error(error);
    return status(500, { error: 'internal_error' as const });
  },
);
