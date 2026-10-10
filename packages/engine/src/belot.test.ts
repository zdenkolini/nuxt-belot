import { describe, expect, test } from 'bun:test';
import {
  belot,
  replay,
  type BelotEvent,
  type BelotMove,
  type BelotState,
  type Card,
  type Seat,
  type Suit,
  type Team,
} from './index';

const variant = { targetScore: 501 } as const;
const seats = [0, 1, 2, 3] as const;
// A 128-bit seed, as 32 hex digits, from a small number.
const seedOf = (n: number) => n.toString(16).padStart(32, '0');
const handsOf = (state: BelotState) =>
  seats.map((seat) => belot.view(state, seat).hand);

describe('setup', () => {
  test('a fixed seed gives the same first dealer and six-card hands', () => {
    const state = belot.setup(variant, 4, seedOf(42));
    expect(belot.setup(variant, 4, seedOf(42))).toEqual(state);
    for (const seat of seats) {
      expect(belot.view(state, seat).hand).toHaveLength(6);
    }
  });

  test('the first dealer comes from the seed', () => {
    const dealers = new Set(
      Array.from(
        { length: 20 },
        (_, seed) =>
          belot.view(belot.setup(variant, 4, seedOf(seed)), 0).dealer,
      ),
    );
    expect(dealers).toEqual(new Set(seats));
  });

  test('every bit of the 128-bit seed changes the deal', () => {
    const low = belot.setup(variant, 4, `${'0'.repeat(31)}1`);
    const high = belot.setup(variant, 4, `8${'0'.repeat(30)}1`);
    expect(handsOf(high)).not.toEqual(handsOf(low));
  });
});

const rightOf = (seat: Seat) => ((seat + 1) % 4) as Seat;

const play = (state: BelotState, seat: Seat, move: BelotMove) => {
  const applied = belot.apply(state, seat, move);
  if (!applied.ok) throw new Error(applied.reason);
  return applied.state;
};

describe('calling', () => {
  test('the seat right of the dealer speaks first, then calling moves counter-clockwise', () => {
    let state = belot.setup(variant, 4, seedOf(42));
    let speaker = rightOf(belot.view(state, 0).dealer);
    for (let i = 0; i < 3; i++) {
      for (const seat of seats) {
        expect(belot.legalMoves(state, seat).length > 0).toBe(seat === speaker);
      }
      state = play(state, speaker, { type: 'pass' });
      speaker = rightOf(speaker);
    }
    expect(speaker).toBe(belot.view(state, 0).dealer);
    expect(belot.legalMoves(state, speaker).length).toBeGreaterThan(0);
  });

  test('the first speaker may pass or call any suit', () => {
    const state = belot.setup(variant, 4, seedOf(42));
    const speaker = rightOf(belot.view(state, 0).dealer);
    expect(belot.legalMoves(state, speaker)).toEqual([
      { type: 'pass' },
      { type: 'call', suit: 'clubs' },
      { type: 'call', suit: 'diamonds' },
      { type: 'call', suit: 'hearts' },
      { type: 'call', suit: 'spades' },
    ]);
  });

  test('the dealer must call after three passes', () => {
    let state = belot.setup(variant, 4, seedOf(7));
    const dealer = belot.view(state, 0).dealer;
    for (let i = 1; i <= 3; i++) {
      state = play(state, ((dealer + i) % 4) as Seat, { type: 'pass' });
    }
    expect(belot.legalMoves(state, dealer)).toEqual([
      { type: 'call', suit: 'clubs' },
      { type: 'call', suit: 'diamonds' },
      { type: 'call', suit: 'hearts' },
      { type: 'call', suit: 'spades' },
    ]);
    expect(belot.apply(state, dealer, { type: 'pass' }).ok).toBe(false);
  });

  test('after a call every seat holds eight cards and trump and caller are set', () => {
    let state = belot.setup(variant, 4, seedOf(42));
    const first = rightOf(belot.view(state, 0).dealer);
    const second = rightOf(first);
    state = play(state, first, { type: 'pass' });
    const applied = belot.apply(state, second, {
      type: 'call',
      suit: 'hearts',
    });
    if (!applied.ok) throw new Error(applied.reason);
    expect(applied.events).toEqual([
      { type: 'called', seat: second, suit: 'hearts' },
    ]);
    const hands = seats.map((seat) => belot.view(applied.state, seat).hand);
    for (const hand of hands) expect(hand).toHaveLength(8);
    expect(new Set(hands.flat().map((card) => card.id)).size).toBe(32);
    for (const seat of seats) {
      expect(belot.view(applied.state, seat)).toMatchObject({
        trump: 'hearts',
        caller: second,
      });
    }
  });

  test('apply rejects out-of-turn and illegal moves', () => {
    let state = belot.setup(variant, 4, seedOf(42));
    const speaker = rightOf(belot.view(state, 0).dealer);
    expect(belot.apply(state, rightOf(speaker), { type: 'pass' }).ok).toBe(
      false,
    );
    expect(
      belot.apply(state, speaker, { type: 'call', suit: 'stars' } as never).ok,
    ).toBe(false);
    state = play(state, speaker, { type: 'call', suit: 'clubs' });
    expect(belot.apply(state, rightOf(speaker), { type: 'pass' }).ok).toBe(
      false,
    );
  });
});

describe('view', () => {
  test('shows a seat its own hand and other seats only as card counts', () => {
    const state = belot.setup(variant, 4, seedOf(42));
    const hands = seats.map((seat) => belot.view(state, seat).hand);
    for (const seat of seats) {
      const view = belot.view(state, seat);
      expect(view.cardCounts).toEqual([6, 6, 6, 6]);
      const seen = JSON.stringify(view);
      for (const other of seats) {
        if (other === seat) continue;
        for (const card of hands[other]!) expect(seen).not.toContain(card.id);
      }
    }
  });
});

const turnOf = (state: BelotState) =>
  seats.find((seat) => belot.legalMoves(state, seat).length > 0)!;

const called = (seed: number) => {
  const state = belot.setup(variant, 4, seedOf(seed));
  const speaker = rightOf(belot.view(state, 0).dealer);
  const suit = (['clubs', 'diamonds', 'hearts', 'spades'] as const)[seed % 4]!;
  return play(state, speaker, { type: 'call', suit });
};

type Turn = {
  state: BelotState;
  seat: Seat;
  hand: Card[];
  trick: { seat: Seat; card: Card }[];
  trump: Suit;
  legal: Card[];
};

// Card order from lowest to highest, as the rules state it.
const plain = ['seven', 'eight', 'nine', 'jack', 'queen', 'king', 'ten', 'ace'];
const trumpRanks = [
  'seven',
  'eight',
  'queen',
  'king',
  'ten',
  'ace',
  'nine',
  'jack',
];

const led = (trick: Turn['trick']) => trick[0]!.card.suit;

const rank = (card: Card, trump: Suit) =>
  card.suit === trump
    ? 100 + trumpRanks.indexOf(card.rank)
    : plain.indexOf(card.rank);

const topOf = (trick: Turn['trick'], trump: Suit) =>
  Math.max(
    ...trick
      .filter(({ card }) => card.suit === trump || card.suit === led(trick))
      .map(({ card }) => rank(card, trump)),
  );

const turnAt = (state: BelotState): Turn => {
  const seat = turnOf(state);
  const view = belot.view(state, seat);
  return {
    state,
    seat,
    hand: view.hand,
    trick: view.trick,
    trump: view.trump!,
    legal: belot
      .legalMoves(state, seat)
      .flatMap((move) => (move.type === 'play' ? [move.card] : [])),
  };
};

// Walks seeded deals, playing varied legal cards, until a turn matches.
const find = (match: (turn: Turn) => boolean): Turn => {
  for (let seed = 0; seed < 2000; seed++) {
    let state = called(seed);
    for (let n = 0; n < 32; n++) {
      const turn = turnAt(state);
      if (match(turn)) return turn;
      const card = turn.legal[(seed * 7 + n * 3) % turn.legal.length]!;
      state = play(state, turn.seat, { type: 'play', card });
    }
  }
  throw new Error('no matching turn');
};

describe('play', () => {
  test('the seat right of the dealer leads the first trick with any card', () => {
    const state = called(42);
    const leader = rightOf(belot.view(state, 0).dealer);
    expect(turnOf(state)).toBe(leader);
    expect(belot.legalMoves(state, leader)).toEqual(
      belot.view(state, leader).hand.map((card) => ({ type: 'play', card })),
    );
  });

  test('a played card leaves the hand, joins the trick, and the turn moves right', () => {
    const state = called(42);
    const leader = turnOf(state);
    const card = belot.view(state, leader).hand[3]!;
    const applied = belot.apply(state, leader, { type: 'play', card });
    if (!applied.ok) throw new Error(applied.reason);
    expect(applied.events).toEqual([{ type: 'played', seat: leader, card }]);
    const view = belot.view(applied.state, leader);
    expect(view.hand).toHaveLength(7);
    expect(view.hand).not.toContainEqual(card);
    expect(view.trick).toEqual([{ seat: leader, card }]);
    expect(turnOf(applied.state)).toBe(rightOf(leader));
  });

  test('a seat holding the led suit must follow it', () => {
    const { hand, legal, trick } = find(
      ({ hand, trick }) =>
        trick.length > 0 && hand.some((card) => card.suit === led(trick)),
    );
    expect(legal.length).toBeGreaterThan(0);
    for (const card of legal) expect(card.suit).toBe(led(trick));
    expect(legal.length).toBeLessThanOrEqual(hand.length);
  });

  test('a seat that can beat the best card of the led suit must play higher', () => {
    const { hand, trick, trump, legal } = find(({ hand, trick, trump }) => {
      if (trick.length === 0 || trick.some(({ card }) => card.suit === trump)) {
        return false;
      }
      const top = topOf(trick, trump);
      const follow = hand.filter((card) => card.suit === led(trick));
      return (
        follow.some((card) => rank(card, trump) > top) &&
        follow.some((card) => rank(card, trump) < top)
      );
    });
    const top = topOf(trick, trump);
    expect(legal).toEqual(
      hand.filter(
        (card) => card.suit === led(trick) && rank(card, trump) > top,
      ),
    );
  });

  test('on a trump lead, a seat must play a higher trump when it can', () => {
    const { hand, trick, trump, legal } = find(({ hand, trick, trump }) => {
      if (trick.length === 0 || led(trick) !== trump) return false;
      const top = topOf(trick, trump);
      const trumps = hand.filter((card) => card.suit === trump);
      return (
        trumps.some((card) => rank(card, trump) > top) &&
        trumps.some((card) => rank(card, trump) < top)
      );
    });
    const top = topOf(trick, trump);
    expect(legal).toEqual(
      hand.filter((card) => card.suit === trump && rank(card, trump) > top),
    );
  });

  test('a seat that follows but cannot go higher may play any card of the led suit', () => {
    const { hand, trick, legal } = find(({ hand, trick, trump }) => {
      if (trick.length === 0) return false;
      const follow = hand.filter((card) => card.suit === led(trick));
      return (
        follow.length > 1 &&
        follow.every((card) => rank(card, trump) < topOf(trick, trump))
      );
    });
    expect(legal).toEqual(hand.filter((card) => card.suit === led(trick)));
  });

  const voidIn = (hand: Card[], suit: Suit) =>
    hand.every((card) => card.suit !== suit);

  test('a seat that cannot follow must trump', () => {
    const { hand, trump, legal } = find(
      ({ hand, trick, trump }) =>
        trick.length > 0 &&
        voidIn(hand, led(trick)) &&
        !voidIn(hand, trump) &&
        trick.every(({ card }) => card.suit !== trump) &&
        hand.some((card) => card.suit !== trump),
    );
    expect(legal).toEqual(hand.filter((card) => card.suit === trump));
  });

  test('a seat that trumps must overtrump when it can', () => {
    const { hand, trick, trump, legal } = find(({ hand, trick, trump }) => {
      if (trick.length === 0 || led(trick) === trump) return false;
      if (!voidIn(hand, led(trick))) return false;
      if (trick.every(({ card }) => card.suit !== trump)) return false;
      const top = topOf(trick, trump);
      const trumps = hand.filter((card) => card.suit === trump);
      return (
        trumps.some((card) => rank(card, trump) > top) &&
        trumps.some((card) => rank(card, trump) < top)
      );
    });
    const top = topOf(trick, trump);
    expect(legal).toEqual(
      hand.filter((card) => card.suit === trump && rank(card, trump) > top),
    );
  });

  test('a seat that cannot overtrump must still trump', () => {
    const { hand, trick, trump, legal } = find(({ hand, trick, trump }) => {
      if (trick.length === 0 || led(trick) === trump) return false;
      if (!voidIn(hand, led(trick)) || voidIn(hand, trump)) return false;
      if (trick.every(({ card }) => card.suit !== trump)) return false;
      return (
        hand.every(
          (card) =>
            card.suit !== trump || rank(card, trump) < topOf(trick, trump),
        ) && hand.some((card) => card.suit !== trump)
      );
    });
    expect(legal).toEqual(hand.filter((card) => card.suit === trump));
  });

  test('a seat that can neither follow nor trump may play any card', () => {
    const { hand, legal } = find(
      ({ hand, trick, trump }) =>
        trick.length > 0 &&
        hand.length > 1 &&
        voidIn(hand, led(trick)) &&
        voidIn(hand, trump),
    );
    expect(legal).toEqual(hand);
  });

  const lastPlay = (turn: Turn) => {
    const card = turn.legal[0]!;
    const applied = belot.apply(turn.state, turn.seat, { type: 'play', card });
    if (!applied.ok) throw new Error(applied.reason);
    return {
      ...applied,
      trick: [...turn.trick, { seat: turn.seat, card }],
    };
  };

  test('without trump in the trick, the highest card of the led suit wins and leads next', () => {
    const turn = find(
      ({ hand, trick, trump, legal }) =>
        hand.length > 1 &&
        trick.length === 3 &&
        trick.every(({ card }) => card.suit !== trump) &&
        legal[0]!.suit !== trump &&
        led(trick) !== trump &&
        trick.some(({ card }) => card.suit !== led(trick)),
    );
    const { trick, events, state } = lastPlay(turn);
    const winner = trick
      .filter(({ card }) => card.suit === led(trick))
      .sort(
        (a, b) => plain.indexOf(b.card.rank) - plain.indexOf(a.card.rank),
      )[0]!;
    expect(events).toContainEqual({ type: 'trickWon', seat: winner.seat });
    expect(turnOf(state)).toBe(winner.seat);
    expect(belot.view(state, 0).trick).toEqual([]);
  });

  test('with trump in the trick, the highest trump wins and leads next', () => {
    const turn = find(
      ({ hand, trick, trump, legal }) =>
        hand.length > 1 &&
        trick.length === 3 &&
        led(trick) !== trump &&
        [...trick.map(({ card }) => card), legal[0]!].filter(
          (card) => card.suit === trump,
        ).length >= 2,
    );
    const { trick, events, state } = lastPlay(turn);
    const winner = trick
      .filter(({ card }) => card.suit === turn.trump)
      .sort(
        (a, b) =>
          trumpRanks.indexOf(b.card.rank) - trumpRanks.indexOf(a.card.rank),
      )[0]!;
    expect(events).toContainEqual({ type: 'trickWon', seat: winner.seat });
    expect(turnOf(state)).toBe(winner.seat);
  });

  test('apply rejects a card the seat does not hold', () => {
    const state = called(42);
    const leader = turnOf(state);
    const card = belot.view(state, rightOf(leader)).hand[0]!;
    expect(belot.apply(state, leader, { type: 'play', card }).ok).toBe(false);
  });
});

type Pick = (turn: Turn, n: number) => Card;

const playDeal = (seed: number, pick: Pick, start = called(seed)) => {
  const caller = belot.view(start, 0).caller!;
  let state = start;
  const events: BelotEvent[] = [];
  for (let n = 0; n < 32; n++) {
    const turn = turnAt(state);
    const applied = belot.apply(state, turn.seat, {
      type: 'play',
      card: pick(turn, n),
    });
    if (!applied.ok) throw new Error(applied.reason);
    state = applied.state;
    events.push(...applied.events);
  }
  const scored = events.find((event) => event.type === 'dealScored');
  if (!scored) throw new Error('deal not scored');
  const winners = events.flatMap((event) =>
    event.type === 'trickWon' ? [event.seat] : [],
  );
  return {
    start,
    state,
    events,
    score: scored.score,
    winners,
    callers: caller % 2,
    others: 1 - (caller % 2),
  };
};

const varied =
  (seed: number): Pick =>
  ({ legal }, n) =>
    legal[(seed * 7 + n * 3) % legal.length]!;

const findDeal = (match: (deal: ReturnType<typeof playDeal>) => boolean) => {
  for (let seed = 0; seed < 2000; seed++) {
    const deal = playDeal(seed, varied(seed));
    if (match(deal)) return deal;
  }
  throw new Error('no matching deal');
};

const points: Record<string, [number, number]> = {
  seven: [0, 0],
  eight: [0, 0],
  nine: [0, 14],
  ten: [10, 10],
  jack: [2, 20],
  queen: [3, 3],
  king: [4, 4],
  ace: [11, 11],
};

const sum = ([a, b]: number[]) => a! + b!;

type Score = ReturnType<typeof playDeal>['score'];
const total = (score: Score, team: number) =>
  score.cards[team]! +
  score.lastTrick[team]! +
  score.sweep[team]! +
  score.declarations[team]! +
  score.belote[team]!;

describe('deal scoring', () => {
  test('the eighth trick scores the deal: card values total 152, plus 10 for the last trick', () => {
    const { score, events, winners, start } = playDeal(42, varied(42));
    const trump = belot.view(start, 0).trump;
    expect(events.at(-1)).toEqual({ type: 'dealScored', score });
    expect(winners).toHaveLength(8);
    expect(sum(score.cards)).toBe(152);
    const lastTeam = winners.at(-1)! % 2;
    expect(score.lastTrick[lastTeam]).toBe(10);
    expect(score.lastTrick[1 - lastTeam]).toBe(0);
    expect(sum(score.cards) + sum(score.lastTrick)).toBe(162);

    const cards: [number, number] = [0, 0];
    const played = events.flatMap((event) =>
      event.type === 'played' ? [event.card] : [],
    );
    winners.forEach((winner, trick) => {
      for (const card of played.slice(trick * 4, trick * 4 + 4)) {
        cards[winner % 2]! += points[card.rank]![card.suit === trump ? 1 : 0]!;
      }
    });
    expect(score.cards).toEqual(cards);
  });

  test('a made contract gives each team its own points', () => {
    const { score, callers, others } = findDeal(
      ({ score, callers, others }) =>
        total(score, callers) > total(score, others) &&
        score.cards[others]! > 0,
    );
    expect(score.failed).toBe(false);
    expect(score.points[callers]).toBe(total(score, callers));
    expect(score.points[others]).toBe(total(score, others));
  });

  test('a failed contract gives all points of the deal to the other team', () => {
    const { score, callers, others } = findDeal(
      ({ score, callers, others }) =>
        total(score, callers) < total(score, others) &&
        sum(score.declarations) + sum(score.belote) === 0,
    );
    expect(score.failed).toBe(true);
    expect(score.points[callers]).toBe(0);
    expect(score.points[others]).toBe(162);
  });

  test('a sweep adds 90 points for the team that won all eight tricks', () => {
    // Callers play their strongest legal card and the others their weakest.
    let deal: ReturnType<typeof playDeal> | undefined;
    for (let seed = 0; seed < 2000 && !deal; seed++) {
      const caller = belot.view(called(seed), 0).caller! % 2;
      const pick: Pick = ({ seat, legal, trump }) => {
        const sorted = [...legal].sort(
          (a, b) => rank(a, trump) - rank(b, trump),
        );
        return seat % 2 === caller ? sorted.at(-1)! : sorted[0]!;
      };
      const played = playDeal(seed, pick);
      if (
        played.winners.every((winner) => winner % 2 === caller) &&
        sum(played.score.declarations) + sum(played.score.belote) === 0
      )
        deal = played;
    }
    const { score, callers, others } = deal!;
    expect(score.sweep[callers]).toBe(90);
    expect(score.sweep[others]).toBe(0);
    expect(score.cards[callers]).toBe(152);
    expect(score.points[callers]).toBe(252);
    expect(score.points[others]).toBe(0);
  });

  test('the next deal starts with the dealer one seat to the right', () => {
    const { start, state } = playDeal(42, varied(42));
    const dealer = belot.view(start, 0).dealer;
    const next = rightOf(dealer);
    for (const seat of seats) {
      expect(belot.view(state, seat)).toMatchObject({
        dealer: next,
        cardCounts: [6, 6, 6, 6],
        trump: null,
        caller: null,
        trick: [],
      });
    }
    expect(turnOf(state)).toBe(rightOf(next));
    expect(belot.legalMoves(state, rightOf(next))[0]).toEqual({ type: 'pass' });
  });

  test('an exact tie is a failed contract', () => {
    const { score, callers, others } = findDeal(
      ({ score, callers }) =>
        total(score, callers) === 81 &&
        sum(score.declarations) + sum(score.belote) === 0,
    );
    expect(score.failed).toBe(true);
    expect(score.points[callers]).toBe(0);
    expect(score.points[others]).toBe(162);
  });
});

// Natural rank order for sequences, from lowest to highest.
const natural = [
  'seven',
  'eight',
  'nine',
  'ten',
  'jack',
  'queen',
  'king',
  'ace',
];
const fourOfAKind: Record<string, number> = {
  jack: 200,
  nine: 150,
  ace: 100,
  ten: 100,
  king: 100,
  queen: 100,
};

// Four of a kind compares by card strength, from lowest to highest.
const strongerFours = ['queen', 'king', 'ten', 'ace'];

type Found = { points: number; length: number; top: number };

// Test-side reading of the declaration rules, used only to pick deals.
const declarationsIn = (hand: Card[]): Found[] => {
  const found: Found[] = [];
  for (const suit of ['clubs', 'diamonds', 'hearts', 'spades']) {
    let run = 0;
    for (let i = 0; i <= 8; i++) {
      if (i < 8 && hand.some((c) => c.suit === suit && c.rank === natural[i])) {
        run++;
        continue;
      }
      if (run >= 3) {
        const points = run === 3 ? 20 : run === 4 ? 50 : 100;
        found.push({ points, length: run, top: i - 1 });
      }
      run = 0;
    }
  }
  for (const [rank, points] of Object.entries(fourOfAKind)) {
    if (hand.filter((card) => card.rank === rank).length === 4) {
      found.push({ points, length: 4, top: strongerFours.indexOf(rank) });
    }
  }
  return found;
};

const handsAt = (seed: number) => {
  const state = called(seed);
  return {
    state,
    dealer: belot.view(state, 0).dealer,
    hands: seats.map((seat) => belot.view(state, seat).hand),
  };
};

const findHands = (
  match: (deal: ReturnType<typeof handsAt>) => boolean,
): ReturnType<typeof handsAt> & { seed: number } => {
  for (let seed = 0; seed < 50000; seed++) {
    const deal = handsAt(seed);
    if (match(deal)) return { ...deal, seed };
  }
  throw new Error('no matching hands');
};

const playFirstTrick = (start: BelotState) => {
  let state = start;
  const events: BelotEvent[] = [];
  for (let n = 0; n < 4; n++) {
    const turn = turnAt(state);
    const applied = belot.apply(state, turn.seat, {
      type: 'play',
      card: turn.legal[0]!,
    });
    if (!applied.ok) throw new Error(applied.reason);
    state = applied.state;
    events.push(...applied.events);
  }
  return { state, events };
};

const holdsFour = (hand: Card[], ranks: string[]) =>
  ranks.some((rank) => hand.filter((card) => card.rank === rank).length === 4);

describe('declarations', () => {
  test('declarations are announced after the first trick and every seat sees them', () => {
    const { state } = findHands(({ hands }) =>
      hands.some((hand) => declarationsIn(hand).length > 0),
    );
    for (const seat of seats) {
      expect(belot.view(state, seat).declarations).toEqual([]);
    }
    const after = playFirstTrick(state);
    const declared = after.events.find((event) => event.type === 'declared');
    if (declared?.type !== 'declared') throw new Error('nothing declared');
    expect(declared.declarations.length).toBeGreaterThan(0);
    for (const seat of seats) {
      expect(belot.view(after.state, seat).declarations).toEqual(
        declared.declarations,
      );
    }
  });

  test.each([
    ['a sequence of three', 'sequence', 20, 3, null],
    ['a sequence of four', 'sequence', 50, 4, null],
    ['a sequence of five', 'sequence', 100, 5, null],
    ['a sequence of six', 'sequence', 100, 6, null],
    ['four jacks', 'fourOfAKind', 200, 4, 'jack'],
    ['four nines', 'fourOfAKind', 150, 4, 'nine'],
    ['four aces', 'fourOfAKind', 100, 4, 'ace'],
    ['four tens', 'fourOfAKind', 100, 4, 'ten'],
    ['four kings', 'fourOfAKind', 100, 4, 'king'],
    ['four queens', 'fourOfAKind', 100, 4, 'queen'],
  ] as const)('%s is worth its value', (_, kind, points, length, rank) => {
    const match = (hand: Card[]) => {
      const found = declarationsIn(hand);
      return (
        found.length === 1 &&
        found[0]!.length === length &&
        (rank ? holdsFour(hand, [rank]) : !holdsFour(hand, natural))
      );
    };
    const { state, hands } = findHands(({ hands }) => hands.some(match));
    const seat = seats.find((seat) => match(hands[seat]!))!;
    const { declarations } = belot.view(playFirstTrick(state).state, seat);
    expect(declarations.filter((d) => d.seat === seat)).toMatchObject([
      { seat, kind, points },
    ]);
  });

  test('four sevens and four eights are not declarations', () => {
    const match = (hand: Card[]) =>
      declarationsIn(hand).length === 0 && holdsFour(hand, ['seven', 'eight']);
    const { state, hands } = findHands(({ hands }) => hands.some(match));
    const seat = seats.find((seat) => match(hands[seat]!))!;
    const { declarations } = belot.view(playFirstTrick(state).state, seat);
    expect(declarations.filter((d) => d.seat === seat)).toEqual([]);
  });
});

type Contender = Found & { seat: Seat };

// Tie-break steps in order: value, length, top card, closest to the dealer's right.
const steps = [
  (d: Contender) => d.points,
  (d: Contender) => d.length,
  (d: Contender) => d.top,
  (d: Contender, dealer: Seat) => -((d.seat - dealer + 3) % 4),
];

// Finds a deal where both teams are still level before `step` and that step
// leaves one team. Returns the team the step picks.
const findContest = (step: number) => {
  let winner = -1;
  const deal = findHands(({ hands, dealer }) => {
    let left: Contender[] = hands.flatMap((hand, seat) =>
      declarationsIn(hand).map((d) => ({ ...d, seat: seat as Seat })),
    );
    for (let i = 0; i <= step; i++) {
      if (i === step && new Set(left.map((d) => d.seat % 2)).size < 2) {
        return false;
      }
      const top = Math.max(...left.map((d) => steps[i]!(d, dealer)));
      left = left.filter((d) => steps[i]!(d, dealer) === top);
    }
    const teams = new Set(left.map((d) => d.seat % 2));
    winner = [...teams][0]!;
    return teams.size === 1;
  });
  return { ...playDeal(deal.seed, varied(deal.seed)), winner };
};

const declaredIn = (events: BelotEvent[]) =>
  events.flatMap((event) =>
    event.type === 'declared' ? event.declarations : [],
  );

describe('declaration comparison', () => {
  test('only the team with the highest declaration scores, and all of its declarations count', () => {
    const deal = findHands(({ hands }) => {
      const team = (t: number) =>
        hands.flatMap((hand, seat) =>
          seat % 2 === t ? declarationsIn(hand) : [],
        );
      const best = (t: number) => Math.max(...team(t).map((d) => d.points));
      return team(0).length >= 2 && team(1).length >= 1 && best(0) > best(1);
    });
    const { score, events } = playDeal(deal.seed, varied(deal.seed));
    const declared = declaredIn(events);
    const ours = declared.filter((d) => d.seat % 2 === 0);
    expect(ours.length).toBeGreaterThanOrEqual(2);
    expect(score.declarations).toEqual([
      ours.reduce((points, d) => points + d.points, 0),
      0,
    ]);
  });

  test.each([
    ['higher value', 0],
    ['equal value, the longer declaration', 1],
    ['equal value and length, the higher top card', 2],
    ['a full tie, the seat closest to the dealer right', 3],
  ])('%s wins', (_, step) => {
    const { score, events, winner } = findContest(step);
    const sumOf = (team: number) =>
      declaredIn(events)
        .filter((d) => d.seat % 2 === team)
        .reduce((points, d) => points + d.points, 0);
    expect(score.declarations[winner]).toBe(sumOf(winner));
    expect(score.declarations[1 - winner]).toBe(0);
    expect(sumOf(1 - winner)).toBeGreaterThan(0);
  });

  test('of two fours with equal value, the stronger card wins: ace, ten, king, queen', () => {
    const holder = (hands: Card[][], rank: string) =>
      seats.find((seat) => holdsFour(hands[seat]!, [rank]));
    const deal = findHands(({ hands }) => {
      const tens = holder(hands, 'ten');
      const other = holder(hands, 'king') ?? holder(hands, 'queen');
      const found = hands.flatMap(declarationsIn);
      return (
        tens !== undefined &&
        other !== undefined &&
        tens % 2 !== other % 2 &&
        holder(hands, 'ace') === undefined &&
        found.every((d) => d.points <= 100 && d.length <= 4)
      );
    });
    const team = holder(deal.hands, 'ten')! % 2;
    const { score } = playDeal(deal.seed, varied(deal.seed));
    expect(score.declarations[team]).toBeGreaterThanOrEqual(100);
    expect(score.declarations[1 - team]).toBe(0);
  });

  test('every seat sees which team scores its declarations once they are announced', () => {
    const { start, score } = findContest(0);
    for (const seat of seats) {
      expect(belot.view(start, seat).declarationPoints).toEqual([0, 0]);
    }
    const { state } = playFirstTrick(start);
    for (const seat of seats) {
      expect(belot.view(state, seat).declarationPoints).toEqual(
        score.declarations,
      );
    }
  });
});

const holdsBelote = (hand: Card[], trump: Suit) =>
  ['king', 'queen'].every((rank) =>
    hand.some((card) => card.suit === trump && card.rank === rank),
  );

const beloteSeat = ({ state, hands }: ReturnType<typeof handsAt>) => {
  const trump = belot.view(state, 0).trump!;
  return seats.find((seat) => holdsBelote(hands[seat]!, trump));
};

describe('belote', () => {
  test('the belote is announced when the first of king and queen of trump is played', () => {
    const deal = findHands((deal) => beloteSeat(deal) !== undefined);
    const holder = beloteSeat(deal)!;
    const trump = belot.view(deal.state, 0).trump!;
    let state = deal.state;
    for (let n = 0; ; n++) {
      for (const seat of seats)
        expect(belot.view(state, seat).belote).toBe(null);
      const turn = turnAt(state);
      const card = varied(deal.seed)(turn, n);
      const applied = belot.apply(state, turn.seat, { type: 'play', card });
      if (!applied.ok) throw new Error(applied.reason);
      state = applied.state;
      const first =
        turn.seat === holder &&
        card.suit === trump &&
        (card.rank === 'king' || card.rank === 'queen');
      if (!first) {
        expect(applied.events).not.toContainEqual({
          type: 'belote',
          seat: holder,
        });
        continue;
      }
      expect(applied.events.slice(0, 2)).toEqual([
        { type: 'played', seat: holder, card },
        { type: 'belote', seat: holder },
      ]);
      for (const seat of seats) {
        expect(belot.view(state, seat).belote).toBe(holder);
      }
      break;
    }
  });

  test('the belote counts 20 for its team even when the other team has the highest declaration', () => {
    const deal = findHands((deal) => {
      const holder = beloteSeat(deal);
      if (holder === undefined) return false;
      const team = (t: number) =>
        deal.hands.flatMap((hand, seat) =>
          seat % 2 === t ? declarationsIn(hand) : [],
        );
      return team(holder % 2).length === 0 && team(1 - (holder % 2)).length > 0;
    });
    const team = beloteSeat(deal)! % 2;
    const { score } = playDeal(deal.seed, varied(deal.seed));
    expect(score.belote[team]).toBe(20);
    expect(score.belote[1 - team]).toBe(0);
    expect(score.declarations[team]).toBe(0);
    expect(score.declarations[1 - team]).toBeGreaterThan(0);
  });

  test('without a belote no team gets its 20 points', () => {
    const deal = findHands((deal) => beloteSeat(deal) === undefined);
    const { score, events } = playDeal(deal.seed, varied(deal.seed));
    expect(score.belote).toEqual([0, 0]);
    expect(events.some((event) => event.type === 'belote')).toBe(false);
  });
});

describe('declarations and the contract', () => {
  const inPlay = (score: Score, team: number) =>
    score.cards[team]! + score.lastTrick[team]! + score.sweep[team]!;

  test("the other team's declarations can make the contract fail", () => {
    const { score, callers, others } = findDeal(
      ({ score, callers, others }) =>
        inPlay(score, callers) > inPlay(score, others) &&
        total(score, callers) <= total(score, others),
    );
    expect(score.declarations[others]! + score.belote[others]!).toBeGreaterThan(
      0,
    );
    expect(score.failed).toBe(true);
    expect(score.points[callers]).toBe(0);
    expect(score.points[others]).toBe(
      total(score, callers) + total(score, others),
    );
  });

  test("the calling team's declarations can make the contract", () => {
    const { score, callers, others } = findDeal(
      ({ score, callers, others }) =>
        inPlay(score, callers) <= inPlay(score, others) &&
        total(score, callers) > total(score, others),
    );
    expect(score.failed).toBe(false);
    expect(score.points[callers]).toBe(total(score, callers));
    expect(score.points[others]).toBe(total(score, others));
  });
});

describe('full sequence', () => {
  // Seed 6753165 deals all eight spades to seat 3.
  const seed = 6753165;
  const calling = (suit: Suit) => {
    const state = belot.setup(variant, 4, seedOf(seed));
    const speaker = rightOf(belot.view(state, 0).dealer);
    return play(state, speaker, { type: 'call', suit });
  };

  test('seat 3 holds all eight spades', () => {
    const hand = belot.view(calling('spades'), 3).hand;
    expect(hand.every((card) => card.suit === 'spades')).toBe(true);
  });

  test('eight cards of a non-trump suit are a declaration worth 120', () => {
    const { score, events } = playDeal(seed, varied(seed), calling('hearts'));
    expect(declaredIn(events)).toContainEqual(
      expect.objectContaining({ seat: 3, kind: 'fullSequence', points: 120 }),
    );
    expect(score.declarations[1]).toBeGreaterThanOrEqual(120);
    expect(score.winsMatch).toBe(null);
  });

  test('eight trumps win the match for their team', () => {
    const { score } = playDeal(seed, varied(seed), calling('spades'));
    expect(score.winsMatch).toBe(1);
  });

  test('eight trumps end the match below the target score', () => {
    const { score, state, events } = playDeal(
      seed,
      varied(seed),
      calling('spades'),
    );
    const result = { winner: 1 as const, scores: score.points };
    expect(score.points[0]! < 501 && score.points[1]! < 501).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'matchEnded', result });
    expect(belot.result(state)).toEqual(result);
    expect(seats.every((s) => belot.legalMoves(state, s).length === 0)).toBe(
      true,
    );
  });

  test('no full sequence wins no match', () => {
    const { score } = playDeal(42, varied(42));
    expect(score.winsMatch).toBe(null);
  });
});

type Logged = { seat: Seat; move: BelotMove };

// Plays a whole match with varied legal moves, from calling to the match end.
const playMatch = (seed: number, targetScore: 501 | 701 | 1001) => {
  let state = belot.setup({ targetScore }, 4, seedOf(seed));
  const moves: Logged[] = [];
  const events: BelotEvent[] = [];
  const results: unknown[] = [];
  for (let n = 0; n < 5000; n++) {
    const seat = seats.find((s) => belot.legalMoves(state, s).length > 0);
    if (seat === undefined) break;
    results.push(belot.result(state));
    const legal = belot.legalMoves(state, seat);
    const move = legal[(seed * 7 + n * 3) % legal.length]!;
    const applied = belot.apply(state, seat, move);
    if (!applied.ok) throw new Error(applied.reason);
    state = applied.state;
    moves.push({ seat, move });
    events.push(...applied.events);
  }
  return { state, moves, events, results };
};

// Running totals after each deal, and the calling team of each deal.
const totals = (events: BelotEvent[]) => {
  const running: [number, number][] = [];
  const callers: Team[] = [];
  let scores: [number, number] = [0, 0];
  for (const event of events) {
    if (event.type === 'called') callers.push((event.seat % 2) as Team);
    if (event.type === 'dealScored') {
      scores = [
        scores[0] + event.score.points[0]!,
        scores[1] + event.score.points[1]!,
      ];
      running.push(scores);
    }
  }
  return { running, callers };
};

describe('match', () => {
  for (const targetScore of [501, 701, 1001] as const) {
    test(`a match to ${targetScore} ends after the first deal where a team reaches it`, () => {
      const { events, results, state } = playMatch(42, targetScore);
      const { running, callers } = totals(events);
      const end = running.findIndex(
        ([a, b]) => a >= targetScore || b >= targetScore,
      );
      expect(end).toBe(running.length - 1);
      const [a, b] = running[end]!;
      const winner = a === b ? callers[end]! : a > b ? 0 : 1;
      expect(events.at(-1)).toEqual({
        type: 'matchEnded',
        result: { winner, scores: [a, b] },
      });
      expect(results.every((result) => result === null)).toBe(true);
      expect(belot.result(state)).toEqual({ winner, scores: [a, b] });
      expect(belot.view(state, 0).scores).toEqual([a, b]);
    });
  }

  // Searches seeded matches to 501 for one whose final deal fits.
  const findEnd = (
    fits: (final: [number, number], caller: Team) => boolean,
  ) => {
    for (let seed = 0; seed < 3000; seed++) {
      const match = playMatch(seed, 501);
      const { running, callers } = totals(match.events);
      if (fits(running.at(-1)!, callers.at(-1)!)) return match;
    }
    throw new Error('no matching match');
  };

  test('when both teams reach the target score in one deal, the higher total wins', () => {
    const { state } = findEnd(([a, b]) => a >= 501 && b >= 501 && a !== b);
    const { scores, winner } = belot.result(state)!;
    expect(winner).toBe(scores[0]! > scores[1]! ? 0 : 1);
  });

  test('when both teams reach the target score with equal totals, the calling team wins', () => {
    const { state, events } = findEnd(([a, b]) => a >= 501 && a === b);
    expect(belot.result(state)!.winner).toBe(totals(events).callers.at(-1)!);
  });

  test('no seat has a legal move after the match ends', () => {
    const { state, moves } = playMatch(7, 501);
    for (const seat of seats) {
      expect(belot.legalMoves(state, seat)).toEqual([]);
      expect(belot.apply(state, seat, { type: 'pass' }).ok).toBe(false);
    }
    expect(belot.apply(state, moves.at(-1)!.seat, moves.at(-1)!.move).ok).toBe(
      false,
    );
  });
});

describe('replay', () => {
  test('replaying seed, variant, and moves gives the live state and events', () => {
    const live = playMatch(42, 701);
    const replayed = replay(
      belot,
      { targetScore: 701 },
      4,
      seedOf(42),
      live.moves,
    );
    expect(replayed).toEqual({
      ok: true,
      state: live.state,
      events: live.events,
    });
  });

  test('replay rejects a log with an illegal move', () => {
    const live = playMatch(42, 701);
    const moves = [...live.moves];
    moves[5] = moves[4]!;
    expect(replay(belot, { targetScore: 701 }, 4, seedOf(42), moves).ok).toBe(
      false,
    );
  });
});

describe('next deal', () => {
  test('a later deal does not repeat the first deal of a nearby seed', () => {
    const second = playDeal(1, varied(1)).state;
    for (let seed = 0; seed < 4; seed++) {
      const first = belot.setup(variant, 4, seedOf(seed));
      expect(handsOf(second)).not.toEqual(handsOf(first));
    }
  });
});
