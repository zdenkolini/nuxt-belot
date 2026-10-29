# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Adults from the Balkans who already know Serbian belot and play it with friends. They want an online table that plays the way the game is played at home. They play on a phone or a computer, often in the evening, in matches that run for many deals.

## Product Purpose

An online multiplayer card game platform. Belot (Serbian variant) is the first ruleset; other card games may follow. Players sit four to a table in two teams and play a match to the target score. Success: regulars choose this table over other belot apps, and come back for ranked play.

## Positioning

What the product must do better than other belot apps:

- **Quality and ease of use.** A table that is quick to understand and quick to start, with no clutter between the player and the game.
- **Performance.** Fast load and fast response on a phone and on a desktop.
- **Ranking.** Ranked matches through a queue change a per-player rating. A leaderboard shows the rating.
- **Skins.** The room host chooses the card face, card back, and table from their skin pool. The table shows the host's choice to all four players.

## Operating Context

- Casual matches happen in rooms. A player creates a room, shares the invite link, and friends join. Rooms are public or private. Room chat is available.
- Ranked matches start only from the queue (ADR 0005), never from a room. Target score is 1001 in ranked matches; 501, 701, or 1001 in casual matches.
- A player who leaves a ranked match and does not return in time causes a forfeit for their team.
- Every player has an account. A player either starts as a guest (one click, auto-generated username, casual play only) or signs in by email magic link and chooses a username before play. A guest can claim their account by connecting an email (ADR 0007). An invite link opened before sign-in leads to the room after sign-in.
- The server holds the game state and enforces the rules (ADR 0001).

## Capabilities and Constraints

- Phone and desktop are both first-class. The game table must work in portrait on a phone.
- Terms follow `GLOSSARY.md` (match, deal, hand, trick, trump, call, declaration, and so on). UI copy uses the same terms.
- UI copy goes through paraglide messages. Several Balkan locales are required (Serbian, Croatian, Bosnian, Montenegrin) plus English. Today only `en.json` exists.
- Skin pool: each player has a pool of paid and earned skins. Earned skins go to top-ranked players (for example, the top 10% by rating). Undecided: the exact earn threshold, prices, and how a player buys a skin.
- Stack: SvelteKit static app, Svelte 5, Tailwind 4, shadcn-svelte (bits-ui), Lucide icons, TanStack Query, Eden client for the Elysia API.

## Brand Commitments

The product name is not decided. "Belot" in the app title is a placeholder. Do not build an identity on the name.

## Evidence on Hand

No player counts, testimonials, reviews, or press. Do not invent them. No skin artwork or card artwork exists yet.

## Product Principles

1. The game comes first. Every screen gets the player to a table, or back to one, with the fewest steps.
2. Play the real game. Rules, terms, and table conduct match how regulars play Serbian belot.
3. Fast everywhere. A phone on a mobile network gets the same quick table as a desktop.
4. Rank is earned and visible. Rating, leaderboard, and earned skins show skill; paid skins never change play or rank.
5. The host sets the table. Skins are the host's choice and all four players see the same table.
