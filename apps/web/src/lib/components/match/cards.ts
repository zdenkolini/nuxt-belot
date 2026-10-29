import { cubicIn } from 'svelte/easing';
import { crossfade, fade } from 'svelte/transition';
import { ranks, suits, type Card, type Rank, type Suit } from '@belot/engine';
import { m } from '#lib/paraglide/messages';

export const suitNames: Record<Suit, () => string> = {
  clubs: m.suit_clubs,
  diamonds: m.suit_diamonds,
  hearts: m.suit_hearts,
  spades: m.suit_spades,
};

export const rankNames: Record<Rank, () => string> = {
  seven: m.rank_seven,
  eight: m.rank_eight,
  nine: m.rank_nine,
  ten: m.rank_ten,
  jack: m.rank_jack,
  queen: m.rank_queen,
  king: m.rank_king,
  ace: m.rank_ace,
};

export const isRed = (suit: Suit) => suit === 'hearts' || suit === 'diamonds';

export const cardName = (card: Card) =>
  m.card_name({ rank: rankNames[card.rank](), suit: suitNames[card.suit]() });

// By suit, then by rank, so a hand reads left to right.
export const sortHand = (hand: Card[]) =>
  hand.toSorted(
    (a, b) =>
      suits.indexOf(a.suit) - suits.indexOf(b.suit) ||
      ranks.indexOf(a.rank) - ranks.indexOf(b.rank),
  );

// A card leaving the hand flies to its place in the trick; cards of other
// players fade in.
export const [send, receive] = crossfade({
  duration: 300,
  fallback: (node) => fade(node, { duration: 200 }),
});

// A won trick slides off the table toward the winner's place (0 me, 1 right,
// 2 top, 3 left).
export const sweep = (_node: Element, { place }: { place: number }) => {
  const [x, y] = (
    [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ] as const
  )[place]!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    duration: reduced ? 0 : 420,
    easing: cubicIn,
    css: (t: number, u: number) =>
      `translate: ${x * u * 35}vmin ${y * u * 35}vmin; opacity: ${Math.min(1, t * 2)}`,
  };
};
