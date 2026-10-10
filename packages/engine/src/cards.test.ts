import { describe, expect, test } from 'bun:test';
import { belotDeck, shuffle } from './index';

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
    ).toEqual(['seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace']);
  });
});

describe('seeded shuffle', () => {
  test('the same seed always gives the same order', () => {
    expect(shuffle(belotDeck(), 42)).toEqual(shuffle(belotDeck(), 42));
  });

  test('different seeds give different orders', () => {
    expect(shuffle(belotDeck(), 1)).not.toEqual(shuffle(belotDeck(), 2));
  });

  test('keeps every card and leaves the input untouched', () => {
    const deck = belotDeck();
    const shuffled = shuffle(deck, 7);
    expect(deck).toEqual(belotDeck());
    expect(shuffled).not.toEqual(deck);
    expect(byId(shuffled)).toEqual(byId(deck));
  });

  test('never reads Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random was called');
    };
    try {
      shuffle(belotDeck(), 3);
    } finally {
      Math.random = original;
    }
  });
});
