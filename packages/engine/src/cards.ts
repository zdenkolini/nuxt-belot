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

// A seed is 128 bits as 32 hex digits. `Random` is the state of sfc32, a
// small generator with 128 bits of state. It is plain data, so a ruleset
// state can carry it from deal to deal.
export type Random = [number, number, number, number];

const next = (random: Random) => {
  const [a, b, c, d] = random;
  const t = (((a + b) | 0) + d) | 0;
  random[0] = b ^ (b >>> 9);
  random[1] = (c + (c << 3)) | 0;
  random[2] = (((c << 21) | (c >>> 11)) + t) | 0;
  random[3] = (d + 1) | 0;
  return (t >>> 0) / 4294967296;
};

export const seeded = (seed: string): Random => {
  const random = [0, 8, 16, 24].map(
    (at) => parseInt(seed.slice(at, at + 8), 16) | 0,
  ) as Random;
  for (let i = 0; i < 15; i++) next(random);
  return random;
};

// Gives the shuffled items and the generator state after the shuffle.
export const shuffle = <T>(
  items: readonly T[],
  random: Random,
): [T[], Random] => {
  const state: Random = [...random];
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next(state) * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return [result, state];
};
