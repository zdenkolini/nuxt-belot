# Belot

An online multiplayer card game platform. Belot (Serbian variant) is the first and priority ruleset; other card games may follow. All code and docs use the English terms below; the Serbian word is listed for lookup.

## Language

### Structure of play

**Match** (_partija_):
All play from 0 points until one team reaches the target score.
_Avoid_: Game, partija

**Deal** (_deljenje_):
One cycle of shuffle, call, eight tricks, and scoring inside a match.
_Avoid_: Round, hand

**Hand** (_ruka_):
The cards one player holds.
_Avoid_: Deal (for one cycle of play)

**Target score**:
The points a team must reach to win a match: 501, 701, or 1001 in casual matches, always 1001 in ranked matches.
_Avoid_: Limit, goal

**Ruleset**:
The complete rules of one card game, such as belot.
_Avoid_: Game type, game

**Variant**:
A set of rule options inside one ruleset, such as the target score.
_Avoid_: Mode

**Casual match**:
A match that does not change any player's rating.
_Avoid_: Casual game, friendly, unranked

**Ranked match**:
A match whose result changes each player's rating.
_Avoid_: Ranked game, competitive, rated game

**Rating**:
A number per player per ruleset that measures skill, changed only by ranked matches.
_Avoid_: MMR, Elo, score (for skill)

**Queue**:
The waiting list where players ask for a ranked match and are matched with others of similar rating.
_Avoid_: Matchmaking lobby, search

**Forfeit**:
A team losing a ranked match because one of its players left it, on purpose or by losing the connection and not returning in time.
_Avoid_: Surrender

### Cards

**Trump** (_adut_):
The suit chosen for a deal that beats every other suit.
_Avoid_: Adut, trump suit

**Trick** (_štih_):
One card from each player, played in turn and won by one player for their team.
_Avoid_: Štih, round

### Calling and scoring

**Call** (_zvanje aduta_):
A player's choice of trump, made from their first six cards.
_Avoid_: Bid

**Must-call** (_mora_):
The rule that the last player to speak must choose a trump if all others passed.
_Avoid_: Mora, forced bid

**Declaration** (_zvanje_):
A scoring card combination in one player's hand, such as a sequence or four of a kind, announced at the start of play.
_Avoid_: Zvanje, meld

**Sequence** (_terca, kvarta, kvinta_):
A declaration of three or more cards of one suit in unbroken order.
_Avoid_: Tierce, quarte, quinte, run

**Four of a kind** (_četiri iste_):
A declaration of all four cards of one rank.
_Avoid_: Carré, square

**Full sequence** (_belot_):
All eight cards of one suit held by one player.
_Avoid_: Belot (for the cards), grand sequence

**Belote** (_bela_):
The king and queen of trump held by one player, worth 20 points.
_Avoid_: Bela, belot declaration, rebelote

**Sweep** (_štilja_):
One team winning all eight tricks of a deal, worth a 90-point bonus.
_Avoid_: Štilja, štiglja, capot, valat

**Failed contract** (_pad_):
The calling team does not score strictly more points than the other team, a tie included, so all points of that deal go to the other team.
_Avoid_: Pad, fall, dedans, inside

### Players

**Guest**:
A player who plays without an email; their account lives only in the browser where they started, and they cannot play ranked matches.
_Avoid_: Anonymous user, temporary account

**Abandon**:
A seated player leaving a running casual match on purpose, which ends the match for everyone at the table.
_Avoid_: Quit, rage-quit, leave match

**Pause**:
The state of a running match while a seated player is not connected; play waits until they return or a seated player ends the match.
_Avoid_: Freeze, hold

**Return**:
A seated player coming back to their paused match, with the same seat and hand.
_Avoid_: Resume, rejoin, reconnect

**Cooldown**:
The time after an abandon during which the player cannot take a seat in any room.
_Avoid_: Timeout, ban, penalty

**Claim**:
The act of a guest connecting an email to their account, so it lasts beyond one browser and they can choose a username.
_Avoid_: Link, bind, convert, upgrade

**Public profile**:
A page anyone can open that shows one player's username and summary stats.
_Avoid_: Player card, user page

**Match history**:
The list of a player's past matches with their results, visible only to logged-in users.
_Avoid_: Game history

**Room**:
The place where players gather, take seats, and play matches together.
_Avoid_: Table, lobby, lounge

**Public room**:
A room listed for anyone to find and join.
_Avoid_: Open room, lobby

**Private room**:
A room that players can join only with its invite link.
_Avoid_: Closed room, invite-only room

**Spectator**:
A person in a room who watches play without a seat; they stop being one when they leave the room, and may watch several rooms at once.
_Avoid_: Observer, viewer

**Room owner**:
The player who controls a room: picks the variant, removes players, and starts matches.
_Avoid_: Host, admin

**Seat**:
A fixed position in a room, numbered 0 to 3; seats 0 and 2 form one team, seats 1 and 3 the other. A player holds at most one seat in all rooms, and keeps it while away from the room until they leave it.
_Avoid_: Position, slot

**Team** (_par_):
The two players in opposite seats, who share one score.
_Avoid_: Pair, partnership

### Monetization

**Card skin**:
A purely visual design for the cards that a player can buy; it never changes the rules.
_Avoid_: Theme, deck style
