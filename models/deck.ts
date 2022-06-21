import zod from 'zod';
import { CardModelType, thirtyTwoCardDeck } from '~/models/card';
import { shuffle } from '~/util/shuffle';

export const deckType = zod.enum(['belot', 'raub', 'remi']);

export type DeckType = zod.infer<typeof deckType>;

export class DeckModel {
  private readonly cards: CardModelType[];

  constructor(public type: DeckType) {
    switch (type) {
      case 'belot': {
        this.cards = shuffle(thirtyTwoCardDeck.slice());
        break;
      }
      default:
        throw new Error('not yet implemented');
    }
  }

  get cardCount() {
    return this.cards.length;
  }

  drawCard = () => this.cards.pop();

  shuffle = () => {
    shuffle(this.cards);
  };
}
