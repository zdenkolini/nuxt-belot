import { describe, expect, test } from 'bun:test';
import {
  belot,
  type BelotEvent,
  type BelotMove,
  type BelotState,
  type Card,
  type Seat,
  type Suit,
} from './index';

const variant = { targetScore: 501 } as const;
const seats = [0, 1, 2, 3] as const;

describe('setup', () => {
  test('a fixed seed gives the same first dealer and six-card hands', () => {
    const state = belot.setup(variant, 4, 42);
    expect(belot.setup(variant, 4, 42)).toEqual(state);
    for (const seat of seats) {
      expect(belot.view(state, seat).hand).toHaveLength(6);
    }
  });

  test('the first dealer comes from the seed', () => {
    const dealers = new Set(
      Array.from(
        { length: 20 },
        (_, seed) => belot.view(belot.setup(variant, 4, seed), 0).dealer,
      ),
    );
    expect(dealers).toEqual(new Set(seats));
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
    let state = belot.setup(variant, 4, 42);
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
    const state = belot.setup(variant, 4, 42);
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
    let state = belot.setup(variant, 4, 7);
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
    let state = belot.setup(variant, 4, 42);
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
    let state = belot.setup(variant, 4, 42);
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
    const state = belot.setup(variant, 4, 42);
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
  const state = belot.setup(variant, 4, seed);
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

const playDeal = (seed: number, pick: Pick) => {
  const start = called(seed);
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
        score.cards[callers]! + score.lastTrick[callers]! >
          score.cards[others]! + score.lastTrick[others]! &&
        score.cards[others]! > 0,
    );
    expect(score.failed).toBe(false);
    expect(score.points[callers]).toBe(
      score.cards[callers]! + score.lastTrick[callers]!,
    );
    expect(score.points[others]).toBe(
      score.cards[others]! + score.lastTrick[others]!,
    );
  });

  test('a failed contract gives all points of the deal to the other team', () => {
    const { score, callers, others } = findDeal(
      ({ score, callers, others }) =>
        score.cards[callers]! + score.lastTrick[callers]! <
        score.cards[others]! + score.lastTrick[others]!,
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
      if (played.winners.every((winner) => winner % 2 === caller))
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
        score.cards[callers]! + score.lastTrick[callers]! === 81,
    );
    expect(score.failed).toBe(true);
    expect(score.points[callers]).toBe(0);
    expect(score.points[others]).toBe(162);
  });
});
