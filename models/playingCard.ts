import zod from 'zod';
import { cardSchema } from '~/models/card';
import { PlayerModel } from '~/models/player';

export const playingCardSchema = cardSchema.extend({
  playedBy: zod.instanceof(PlayerModel),
});

export type PlayingCardSchema = zod.infer<typeof playingCardSchema>;
