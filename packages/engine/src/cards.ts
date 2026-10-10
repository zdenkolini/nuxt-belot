export const suits = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export const ranks = [
  'seven',
  'eight',
  'nine',
  'ten',
  'jack',
  'queen',
  'king',
  'ace',
] as const;

export type Suit = (typeof suits)[number];
export type Rank = (typeof ranks)[number];
export type Card = { id: string; suit: Suit; rank: Rank };

export const belotDeck = (): Card[] =>
  suits.flatMap((suit) =>
    ranks.map((rank) => ({ id: `${rank}-${suit}`, suit, rank })),
  );

// mulberry32: a small seeded generator returning floats in [0, 1)
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const shuffle = <T>(items: readonly T[], seed: number): T[] => {
  const next = random(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
};
