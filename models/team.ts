import zod from 'zod';
import { PlayerModel } from '~/models/player';

export const teamSchema = zod.object({
  players: zod.array(zod.instanceof(PlayerModel)),
  score: zod.number(),
});

export type TeamSchema = zod.infer<typeof teamSchema>;
