import { describe, expect, test } from 'bun:test';
import { belotDeck, seeded, shuffle } from './index';

const shuffled = (n: number) =>
  shuffle(belotDeck(), seeded(n.toString(16).padStart(32, '0')))[0];

const byId = (cards: { id: string }[]) =>
  [...cards].sort((a, b) => a.id.localeCompare(b.id));

describe('belot deck', () => {
  test('has 32 distinct cards, seven to ace in four suits', () => {
    const deck = belotDeck();
    expect(deck).toHaveLength(32);
    expect(new Set(deck.map((card) => card.id)).size).toBe(32);
    expect(new Set(deck.map((card) => card.suit))).toEqual(
      new Set(['clubs', 'diamonds', 'hearts', 'spades']),
    );
    expect(
      deck.filter((card) => card.suit === 'hearts').map((card) => card.rank),
    ).toEqual([
      'seven',
      'eight',
      'nine',
      'ten',
      'jack',
      'queen',
      'king',
      'ace',
    ]);
  });
});

describe('seeded shuffle', () => {
  test('the same seed always gives the same order', () => {
    expect(shuffled(42)).toEqual(shuffled(42));
  });

  test('different seeds give different orders', () => {
    expect(shuffled(1)).not.toEqual(shuffled(2));
  });

  test('keeps every card and leaves the input untouched', () => {
    const deck = belotDeck();
    const random = seeded('7'.padStart(32, '0'));
    const [result] = shuffle(deck, random);
    expect(deck).toEqual(belotDeck());
    expect(result).not.toEqual(deck);
    expect(byId(result)).toEqual(byId(deck));
  });

  test('never reads Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random was called');
    };
    try {
      shuffled(3);
    } finally {
      Math.random = original;
    }
  });
});
