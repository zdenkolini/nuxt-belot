import zod from 'zod';
import { DeckModel } from '~/models/deck';
import { PlayerModel } from '~/models/player';
import { shuffle } from '~/util/shuffle';

const gameStateEnum = zod.enum(['ready', 'playing', 'finished']);
export type GameState = zod.infer<typeof gameStateEnum>;

export class Game {
  state: GameState = 'ready';
  log: string[] = [];

  constructor(
    private deck: DeckModel,
    private players: [PlayerModel, PlayerModel, PlayerModel, PlayerModel],
  ) {}

  initialize = () => {
    let counter = 0;
    while (this.deck.cardCount > 0) {
      this.players[counter++].receiveCard(this.deck.drawCard()!);

      if (counter === 5) {
        counter = 0;
      }
    }
    shuffle(this.players);
    this.state = 'playing';
    log.push();
  };
}
