import zod from 'zod';

export const possibleCardSigns = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
] as const;
export const possibleCardSuits = ['spade', 'club', 'heart', 'diamond'] as const;
export const cardSignEnum = zod.enum(possibleCardSigns);
export const cardSuitEnum = zod.enum(possibleCardSuits);
export const cardSchema = zod.object({
  id: zod.string(),
  sign: cardSignEnum,
  suit: cardSuitEnum,
});

export type CardSuitEnum = zod.infer<typeof cardSuitEnum>;
export type CardSignEnum = zod.infer<typeof cardSignEnum>;
export type CardSchema = zod.infer<typeof cardSchema>;

export const thirtyTwoCardDeck = possibleCardSuits
  .reduce(
    (accumulator, suit, _currentIndex) => [
      ...accumulator,
      ...possibleCardSigns
        .filter((cardSign) => !['2', '3', '4', '5', '6'].includes(cardSign))
        .map(
          (sign): CardSchema => ({
            id: suit + sign,
            sign,
            suit,
          }),
        ),
    ],
    [] as CardSchema[],
  )
  .flat();
export const fiftyTwoCardDeck = possibleCardSuits
  .reduce(
    (accumulator, suit, _currentIndex) => [
      ...accumulator,
      ...possibleCardSigns.map(
        (sign): CardSchema => ({
          id: suit + sign,
          sign,
          suit,
        }),
      ),
    ],
    [] as CardSchema[],
  )
  .flat();
