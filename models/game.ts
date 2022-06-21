import zod from 'zod';
import { DeckModel } from '~/models/deck';
import { PlayerModel } from '~/models/player';
import { shuffle } from '~/util/shuffle';
import { CardSchema } from '~/models/card';
import { TeamSchema } from '~/models/team';
import { PlayingCardSchema } from '~/models/playingCard';

const gameStateEnum = zod.enum(['ready', 'playing', 'finished']);
export type GameState = zod.infer<typeof gameStateEnum>;

export class BelotGame {
  readonly type = 'belot';
  private deck: DeckModel;
  state: GameState = 'ready';
  log: string[] = [];

  team1: TeamSchema = { players: [], score: 0 };
  team2: TeamSchema = { players: [], score: 0 };

  table: PlayingCardSchema[] = [];

  constructor(
    private players: [PlayerModel, PlayerModel, PlayerModel, PlayerModel],
  ) {
    this.deck = new DeckModel('belot');
  }

  initialize = () => {
    let counter = 0;
    const playerHands: CardSchema[][] = [[], [], [], []];

    while (this.deck.cardCount > 0) {
      playerHands[counter++].push(this.deck.drawCard()!);

      if (counter === 5) {
        counter = 0;
      }
    }

    playerHands.forEach((hand, index) => {
      const player = this.players[index];

      this.log.push(
        `dealing hand ${hand.map(({ id }) => id).join(',')} to player ${
          player.name
        }`,
      );

      this.players[index].assignHand(hand);
    });

    shuffle(this.players);

    this.team1.players = this.players.slice(0, 2);
    this.team2.players = this.players.slice(2);

    this.state = 'playing';
    this.log.push(`starting ${this.type} game`);
    this.log.push(
      `team1 (${this.team1.players[0].name}, ${this.team1.players[1].name})`,
    );
    this.log.push(
      `team2 (${this.team2.players[0].name}, ${this.team2.players[1].name})`,
    );
  };

  playCard = (player: PlayerModel, card: CardSchema) => {
    this.table.push({ ...card, playedBy: player });
    this.log.push(`${card.id} played by ${player.name}`);
  };

  static getWinningCard = () => {};
}
