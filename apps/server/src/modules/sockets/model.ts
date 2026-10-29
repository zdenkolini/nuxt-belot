import { t } from 'elysia';

export const roomParams = t.Object({ id: t.String({ format: 'uuid' }) });
