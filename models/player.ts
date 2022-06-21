import { CardSchema } from '~/models/card';

export class PlayerModel {
  private hand: CardSchema[] = [];
  teamId?: string;

  constructor(public readonly name: string) {}

  assignHand = (hand: CardSchema[]) => {
    this.hand = hand;
  };

  assignTeam = (teamId: string) => {
    this.teamId = teamId;
  };

  receiveCard = (card: CardSchema) => {
    this.hand.push(card);
  };
}
