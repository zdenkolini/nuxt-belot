import { crossfade, fade } from 'svelte/transition';
import { ranks, suits, type Card, type Rank, type Suit } from '@belot/engine';
import { m } from '#lib/paraglide/messages.js';

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

export const suitSymbols: Record<Suit, string> = {
	clubs: '♣',
	diamonds: '♦',
	hearts: '♥',
	spades: '♠',
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
