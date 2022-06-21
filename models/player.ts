import { CardModelType } from '~/models/card';

export class PlayerModel {
  private hand: CardModelType[] = [];

  constructor(public readonly name: string) {}

  assignHand = (hand: CardModelType[]) => {
    this.hand = hand;
  };

  receiveCard = (card: CardModelType) => {
    this.hand.push(card);
  };
}
