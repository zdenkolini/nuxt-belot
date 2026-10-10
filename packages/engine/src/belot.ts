import {
  belotDeck,
  ranks,
  seeded,
  shuffle,
  suits,
  type Card,
  type Random,
  type Rank,
  type Suit,
} from './cards';
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
  | { type: 'declared'; declarations: Declaration[] }
  | { type: 'belote'; seat: Seat }
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
  declarations: TeamPoints;
  belote: TeamPoints;
  failed: boolean;
  points: TeamPoints;
  // The team that wins the match outright with a full sequence, if any.
  winsMatch: Team | null;
};

export type Declaration = {
  seat: Seat;
  kind: 'sequence' | 'fourOfAKind' | 'fullSequence';
  cards: Card[];
  points: number;
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
  declarations: Declaration[];
  belote: Seat | null;
};

export type BelotState = {
  variant: BelotVariant;
  // The generator state after the last shuffle; the next deal shuffles from it.
  random: Random;
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
  declarations: Declaration[];
  // What the announced declarations score for each team; only one team scores.
  declarationPoints: TeamPoints;
  belote: Seat | null;
  scores: TeamPoints;
};

const rightOf = (seat: Seat) => ((seat + 1) % 4) as Seat;

const startDeal = (dealer: Seat, from: Random): [Deal, Random] => {
  const [deck, random] = shuffle(belotDeck(), from);
  const deal: Deal = {
    phase: 'calling',
    dealer,
    turn: rightOf(dealer),
    hands: [0, 1, 2, 3].map((seat) => deck.slice(seat * 6, seat * 6 + 6)),
    stock: deck.slice(24),
    trump: null,
    caller: null,
    trick: [],
    tricks: [],
    declarations: [],
    belote: null,
  };
  return [deal, random];
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

// Ties break by value, then length, then top card, then the seat closest
// to the dealer's right.
const declarationKey = (declaration: Declaration, dealer: Seat) => [
  declaration.points,
  declaration.cards.length,
  ranks.indexOf(declaration.cards.at(-1)!.rank),
  -((declaration.seat - dealer + 3) % 4),
];

const outranks = (a: Declaration, b: Declaration, dealer: Seat) => {
  const keyA = declarationKey(a, dealer);
  const keyB = declarationKey(b, dealer);
  const step = keyA.findIndex((value, i) => value !== keyB[i]);
  return step >= 0 && keyA[step]! > keyB[step]!;
};

// Only the team with the highest declaration scores, with all of its declarations.
const scoreDeclarations = (deal: Deal): TeamPoints => {
  const points: TeamPoints = [0, 0];
  if (deal.declarations.length === 0) return points;
  const highest = deal.declarations.reduce((top, declaration) =>
    outranks(declaration, top, deal.dealer) ? declaration : top,
  );
  const team = teamOf(highest.seat);
  for (const declaration of deal.declarations) {
    if (teamOf(declaration.seat) === team) points[team] += declaration.points;
  }
  return points;
};

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

  const declarations = scoreDeclarations(deal);
  const belote: TeamPoints = [0, 0];
  if (deal.belote !== null) belote[teamOf(deal.belote)] = 20;

  const parts = [cards, lastTrick, sweep, declarations, belote];
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
  const full = deal.declarations.find(
    ({ kind, cards }) =>
      kind === 'fullSequence' &&
      fullSequence(cards[0]!.suit, deal.trump!).winsMatch,
  );
  const winsMatch = full ? teamOf(full.seat) : null;
  return {
    cards,
    lastTrick,
    sweep,
    declarations,
    belote,
    failed,
    points,
    winsMatch,
  };
};

const sequencePoints = (length: number) =>
  length === 3 ? 20 : length === 4 ? 50 : 100;

const fourOfAKindPoints: Partial<Record<Rank, number>> = {
  jack: 200,
  nine: 150,
  ace: 100,
  ten: 100,
  king: 100,
  queen: 100,
};

// Full sequence: the rule is an open question (#140 Further Notes).
// Current assumption: eight trumps win the match; eight cards of another
// suit are a declaration worth 120. Change the rule here only.
const fullSequence = (suit: Suit, trump: Suit) =>
  suit === trump
    ? { points: 0, winsMatch: true }
    : { points: 120, winsMatch: false };

const declarationsOf = (seat: Seat, hand: Card[], trump: Suit) => {
  const found: Declaration[] = [];
  for (const suit of suits) {
    let run: Card[] = [];
    for (const rank of [...ranks, null]) {
      const card = hand.find(
        (held) => held.suit === suit && held.rank === rank,
      );
      if (card) {
        run.push(card);
        continue;
      }
      if (run.length === 8) {
        const { points } = fullSequence(suit, trump);
        found.push({ seat, kind: 'fullSequence', cards: run, points });
      } else if (run.length >= 3) {
        const points = sequencePoints(run.length);
        found.push({ seat, kind: 'sequence', cards: run, points });
      }
      run = [];
    }
  }
  for (const [rank, points] of Object.entries(fourOfAKindPoints)) {
    const cards = hand.filter((held) => held.rank === rank);
    if (cards.length === 4) {
      found.push({ seat, kind: 'fourOfAKind', cards, points });
    }
  }
  return found;
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

const call = (deal: Deal, seat: Seat, trump: Suit): Deal => {
  const hands = deal.hands.map((hand, i) => [
    ...hand,
    ...deal.stock.slice(i * 2, i * 2 + 2),
  ]);
  return {
    ...deal,
    phase: 'playing',
    turn: rightOf(deal.dealer),
    hands,
    stock: [],
    trump,
    caller: seat,
    declarations: hands.flatMap((hand, i) =>
      declarationsOf(i as Seat, hand, trump),
    ),
  };
};

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
  const pair =
    card.rank === 'king' ? 'queen' : card.rank === 'queen' ? 'king' : null;
  const belote =
    card.suit === deal.trump &&
    hands[seat]!.some((held) => held.suit === card.suit && held.rank === pair)
      ? seat
      : deal.belote;
  if (belote !== deal.belote) events.push({ type: 'belote', seat });
  if (trick.length < 4) {
    return {
      ok: true,
      state: {
        ...state,
        deal: { ...deal, hands, trick, belote, turn: rightOf(seat) },
      },
      events,
    };
  }
  const winner = best(trick, deal.trump!).seat;
  events.push({ type: 'trickWon', seat: winner });
  const tricks = [...deal.tricks, { plays: trick, winner }];
  if (tricks.length === 1 && deal.declarations.length > 0) {
    events.push({ type: 'declared', declarations: deal.declarations });
  }
  if (tricks.length === 8) {
    const score = scoreDeal({ ...deal, tricks, belote });
    events.push({ type: 'dealScored', score });
    const scores: TeamPoints = [
      state.scores[0] + score.points[0],
      state.scores[1] + score.points[1],
    ];
    const { targetScore } = state.variant;
    if (
      score.winsMatch !== null ||
      scores[0] >= targetScore ||
      scores[1] >= targetScore
    ) {
      const winner: Team =
        score.winsMatch ??
        (scores[0] === scores[1]
          ? teamOf(deal.caller!)
          : scores[0] > scores[1]
            ? 0
            : 1);
      const result = { winner, scores };
      events.push({ type: 'matchEnded', result });
      return {
        ok: true,
        state: {
          ...state,
          scores,
          result,
          deal: { ...deal, hands, trick: [], tricks, belote },
        },
        events,
      };
    }
    const [next, random] = startDeal(rightOf(deal.dealer), state.random);
    return {
      ok: true,
      state: {
        ...state,
        random,
        deals: state.deals + 1,
        scores,
        deal: next,
      },
      events,
    };
  }
  return {
    ok: true,
    state: {
      ...state,
      deal: { ...deal, hands, trick: [], tricks, belote, turn: winner },
    },
    events,
  };
};

export const belot = {
  setup: (variant: BelotVariant, _seats: number, seed: string): BelotState => {
    const [dealers, afterDealer] = shuffle([0, 1, 2, 3] as const, seeded(seed));
    const [deal, random] = startDeal(dealers[0]!, afterDealer);
    return { variant, random, deals: 0, scores: [0, 0], result: null, deal };
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
  view: (state: BelotState, seat: Seat): BelotView => {
    const announced = state.deal.tricks.length > 0;
    return {
      dealer: state.deal.dealer,
      hand: state.deal.hands[seat]!,
      cardCounts: state.deal.hands.map((hand) => hand.length),
      trump: state.deal.trump,
      caller: state.deal.caller,
      trick: state.deal.trick,
      declarations: announced ? state.deal.declarations : [],
      declarationPoints: announced ? scoreDeclarations(state.deal) : [0, 0],
      belote: state.deal.belote,
      scores: state.scores,
    };
  },
  result: (state: BelotState) => state.result,
} satisfies Ruleset<
  BelotVariant,
  BelotState,
  BelotMove,
  BelotEvent,
  BelotView,
  BelotResult
>;
