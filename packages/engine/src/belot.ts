import { belotDeck, shuffle, suits, type Card, type Suit } from './cards';
import type { Applied, Ruleset, Seat } from './ruleset';

export type BelotVariant = { targetScore: 501 | 701 | 1001 };

export type BelotMove = { type: 'pass' } | { type: 'call'; suit: Suit };

export type BelotEvent =
  { type: 'passed'; seat: Seat } | { type: 'called'; seat: Seat; suit: Suit };

export type Deal = {
  phase: 'calling' | 'playing';
  dealer: Seat;
  turn: Seat;
  hands: Card[][];
  stock: Card[];
  trump: Suit | null;
  caller: Seat | null;
};

export type BelotState = {
  variant: BelotVariant;
  seed: number;
  deal: Deal;
};

export type BelotView = {
  dealer: Seat;
  hand: Card[];
  cardCounts: number[];
  trump: Suit | null;
  caller: Seat | null;
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
  };
};

const legalMoves = (state: BelotState, seat: Seat): BelotMove[] => {
  const { phase, turn, dealer } = state.deal;
  if (phase !== 'calling' || seat !== turn) return [];
  const calls = suits.map((suit) => ({ type: 'call' as const, suit }));
  return seat === dealer ? calls : [{ type: 'pass' }, ...calls];
};

const sameMove = (a: BelotMove, b: BelotMove) =>
  a.type === b.type &&
  (a.type !== 'call' || (b.type === 'call' && a.suit === b.suit));

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

export const belot = {
  setup: (variant: BelotVariant, _seats: number, seed: number): BelotState => {
    const dealer = shuffle([0, 1, 2, 3] as const, seed)[0]!;
    return { variant, seed, deal: startDeal(dealer, seed + 1) };
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
  }),
  result: () => null,
} satisfies Ruleset<
  BelotVariant,
  BelotState,
  BelotMove,
  BelotEvent,
  BelotView,
  never
>;
