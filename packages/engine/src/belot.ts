import { belotDeck, shuffle, suits, type Card, type Suit } from './cards';
import type { Applied, Ruleset, Seat } from './ruleset';

export type BelotVariant = { targetScore: 501 | 701 | 1001 };

export type BelotMove =
  | { type: 'pass' }
  | { type: 'call'; suit: Suit }
  | { type: 'play'; card: Card };

export type BelotEvent =
  | { type: 'passed'; seat: Seat }
  | { type: 'called'; seat: Seat; suit: Suit }
  | { type: 'played'; seat: Seat; card: Card }
  | { type: 'trickWon'; seat: Seat }
  | { type: 'dealScored'; score: DealScore }
  | { type: 'matchEnded'; result: BelotResult };

// Seats 0 and 2 are team 0, seats 1 and 3 are team 1.
export type Team = 0 | 1;
// Points by team. Each part of a deal score counts toward the contract.
export type TeamPoints = [number, number];
export type DealScore = {
  cards: TeamPoints;
  lastTrick: TeamPoints;
  sweep: TeamPoints;
  failed: boolean;
  points: TeamPoints;
};

export type BelotResult = { winner: Team; scores: TeamPoints };

export type Play = { seat: Seat; card: Card };
export type Trick = { plays: Play[]; winner: Seat };

export type Deal = {
  phase: 'calling' | 'playing';
  dealer: Seat;
  turn: Seat;
  hands: Card[][];
  stock: Card[];
  trump: Suit | null;
  caller: Seat | null;
  trick: Play[];
  tricks: Trick[];
};

export type BelotState = {
  variant: BelotVariant;
  seed: number;
  deals: number;
  scores: TeamPoints;
  result: BelotResult | null;
  deal: Deal;
};

export type BelotView = {
  dealer: Seat;
  hand: Card[];
  cardCounts: number[];
  trump: Suit | null;
  caller: Seat | null;
  trick: Play[];
  scores: TeamPoints;
};

const rightOf = (seat: Seat) => ((seat + 1) % 4) as Seat;

const startDeal = (dealer: Seat, seed: number): Deal => {
  const deck = shuffle(belotDeck(), seed);
  return {
    phase: 'calling',
    dealer,
    turn: rightOf(dealer),
    hands: [0, 1, 2, 3].map((seat) => deck.slice(seat * 6, seat * 6 + 6)),
    stock: deck.slice(24),
    trump: null,
    caller: null,
    trick: [],
    tricks: [],
  };
};

// Rank order from lowest to highest.
const plainOrder = [
  'seven',
  'eight',
  'nine',
  'jack',
  'queen',
  'king',
  'ten',
  'ace',
];
const trumpOrder = [
  'seven',
  'eight',
  'queen',
  'king',
  'ten',
  'ace',
  'nine',
  'jack',
];

const strength = (card: Card, trump: Suit, led: Suit) => {
  if (card.suit === trump) return 100 + trumpOrder.indexOf(card.rank);
  return card.suit === led ? plainOrder.indexOf(card.rank) : -1;
};

const best = (trick: Play[], trump: Suit) => {
  const led = trick[0]!.card.suit;
  return trick.reduce((top, play) =>
    strength(play.card, trump, led) > strength(top.card, trump, led)
      ? play
      : top,
  );
};

const cardPoints: Record<Card['rank'], [plain: number, trump: number]> = {
  seven: [0, 0],
  eight: [0, 0],
  nine: [0, 14],
  ten: [10, 10],
  jack: [2, 20],
  queen: [3, 3],
  king: [4, 4],
  ace: [11, 11],
};

const teamOf = (seat: Seat) => (seat % 2) as Team;

const scoreDeal = (deal: Deal): DealScore => {
  const cards: TeamPoints = [0, 0];
  for (const { plays, winner } of deal.tricks) {
    for (const { card } of plays) {
      cards[teamOf(winner)] +=
        cardPoints[card.rank][card.suit === deal.trump ? 1 : 0];
    }
  }
  const lastTrick: TeamPoints = [0, 0];
  lastTrick[teamOf(deal.tricks.at(-1)!.winner)] = 10;
  const sweep: TeamPoints = [0, 0];
  const winners = new Set(deal.tricks.map(({ winner }) => teamOf(winner)));
  if (winners.size === 1) sweep[[...winners][0]!] = 90;

  const parts = [cards, lastTrick, sweep];
  const total = (team: Team) =>
    parts.reduce((sum, part) => sum + part[team], 0);
  const callers = teamOf(deal.caller!);
  const others = (1 - callers) as Team;
  const failed = total(callers) <= total(others);
  const points: TeamPoints = [total(0), total(1)];
  if (failed) {
    points[others] = total(0) + total(1);
    points[callers] = 0;
  }
  return { cards, lastTrick, sweep, failed, points };
};

const legalCards = (hand: Card[], trick: Play[], trump: Suit): Card[] => {
  if (trick.length === 0) return hand;
  const led = trick[0]!.card.suit;
  const top = strength(best(trick, trump).card, trump, led);
  const higher = (cards: Card[]) => {
    const above = cards.filter((card) => strength(card, trump, led) > top);
    return above.length > 0 ? above : cards;
  };
  const follow = hand.filter((card) => card.suit === led);
  if (follow.length > 0) return higher(follow);
  const trumps = hand.filter((card) => card.suit === trump);
  return trumps.length > 0 ? higher(trumps) : hand;
};

const legalMoves = (state: BelotState, seat: Seat): BelotMove[] => {
  const { phase, turn, dealer, hands, trick } = state.deal;
  if (state.result || seat !== turn) return [];
  if (phase === 'playing') {
    return legalCards(hands[seat]!, trick, state.deal.trump!).map((card) => ({
      type: 'play' as const,
      card,
    }));
  }
  const calls = suits.map((suit) => ({ type: 'call' as const, suit }));
  return seat === dealer ? calls : [{ type: 'pass' }, ...calls];
};

const sameMove = (a: BelotMove, b: BelotMove) => {
  if (a.type === 'call') return b.type === 'call' && a.suit === b.suit;
  if (a.type === 'play') return b.type === 'play' && a.card.id === b.card.id;
  return a.type === b.type;
};

const call = (deal: Deal, seat: Seat, trump: Suit): Deal => ({
  ...deal,
  phase: 'playing',
  turn: rightOf(deal.dealer),
  hands: deal.hands.map((hand, i) => [
    ...hand,
    ...deal.stock.slice(i * 2, i * 2 + 2),
  ]),
  stock: [],
  trump,
  caller: seat,
});

const playCard = (
  state: BelotState,
  seat: Seat,
  played: Card,
): Applied<BelotState, BelotEvent> => {
  const { deal } = state;
  const card = deal.hands[seat]!.find((held) => held.id === played.id)!;
  const hands = deal.hands.map((hand, i) =>
    i === seat ? hand.filter((held) => held.id !== card.id) : hand,
  );
  const trick = [...deal.trick, { seat, card }];
  const events: BelotEvent[] = [{ type: 'played', seat, card }];
  if (trick.length < 4) {
    return {
      ok: true,
      state: { ...state, deal: { ...deal, hands, trick, turn: rightOf(seat) } },
      events,
    };
  }
  const winner = best(trick, deal.trump!).seat;
  events.push({ type: 'trickWon', seat: winner });
  const tricks = [...deal.tricks, { plays: trick, winner }];
  if (tricks.length === 8) {
    const score = scoreDeal({ ...deal, tricks });
    events.push({ type: 'dealScored', score });
    const scores: TeamPoints = [
      state.scores[0] + score.points[0],
      state.scores[1] + score.points[1],
    ];
    const { targetScore } = state.variant;
    if (scores[0] >= targetScore || scores[1] >= targetScore) {
      const winner: Team =
        scores[0] === scores[1]
          ? teamOf(deal.caller!)
          : scores[0] > scores[1]
            ? 0
            : 1;
      const result = { winner, scores };
      events.push({ type: 'matchEnded', result });
      return {
        ok: true,
        state: {
          ...state,
          scores,
          result,
          deal: { ...deal, hands, trick: [], tricks },
        },
        events,
      };
    }
    const deals = state.deals + 1;
    return {
      ok: true,
      state: {
        ...state,
        deals,
        scores,
        deal: startDeal(rightOf(deal.dealer), state.seed + deals + 1),
      },
      events,
    };
  }
  return {
    ok: true,
    state: {
      ...state,
      deal: { ...deal, hands, trick: [], tricks, turn: winner },
    },
    events,
  };
};

export const belot = {
  setup: (variant: BelotVariant, _seats: number, seed: number): BelotState => {
    const dealer = shuffle([0, 1, 2, 3] as const, seed)[0]!;
    return {
      variant,
      seed,
      deals: 0,
      scores: [0, 0],
      result: null,
      deal: startDeal(dealer, seed + 1),
    };
  },
  legalMoves,
  apply: (
    state: BelotState,
    seat: Seat,
    move: BelotMove,
  ): Applied<BelotState, BelotEvent> => {
    if (!legalMoves(state, seat).some((legal) => sameMove(legal, move))) {
      return { ok: false, reason: 'illegal move' };
    }
    if (move.type === 'play') return playCard(state, seat, move.card);
    if (move.type === 'call') {
      return {
        ok: true,
        state: { ...state, deal: call(state.deal, seat, move.suit) },
        events: [{ type: 'called', seat, suit: move.suit }],
      };
    }
    return {
      ok: true,
      state: { ...state, deal: { ...state.deal, turn: rightOf(seat) } },
      events: [{ type: 'passed', seat }],
    };
  },
  view: (state: BelotState, seat: Seat): BelotView => ({
    dealer: state.deal.dealer,
    hand: state.deal.hands[seat]!,
    cardCounts: state.deal.hands.map((hand) => hand.length),
    trump: state.deal.trump,
    caller: state.deal.caller,
    trick: state.deal.trick,
    scores: state.scores,
  }),
  result: (state: BelotState) => state.result,
} satisfies Ruleset<
  BelotVariant,
  BelotState,
  BelotMove,
  BelotEvent,
  BelotView,
  BelotResult
>;
