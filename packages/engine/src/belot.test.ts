import { describe, expect, test } from 'bun:test';
import { belot, type BelotMove, type BelotState, type Seat } from './index';

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
