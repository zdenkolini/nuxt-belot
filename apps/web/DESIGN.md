---
name: Belot (working title)
description: A kafana room in 2.5D. A wooden table with a red gingham cloth, tilted away; players in chairs around it; paper and cards on and around it.
colors:
  cloth: "oklch(0.975 0.006 85)"
  cloth-thread: "oklch(0.56 0.19 26 / 0.5)"
  paper: "oklch(0.985 0.008 95)"
  paper-shade: "oklch(0.93 0.015 95)"
  paper-rule: "oklch(0.7 0.07 245 / 0.4)"
  ink: "oklch(0.26 0.06 262)"
  ink-soft: "oklch(0.44 0.05 262)"
  ink-line: "oklch(0.26 0.06 262 / 0.28)"
  oxblood: "oklch(0.4 0.14 22)"
  card-face: "oklch(0.995 0.002 95)"
  card-red: "oklch(0.53 0.21 27)"
  card-black: "oklch(0.2 0.02 262)"
  card-back: "oklch(0.4 0.14 22)"
  card-back-line: "oklch(0.995 0.002 95 / 0.22)"
  coaster: "oklch(0.83 0.05 70)"
  wall: "oklch(0.34 0.05 150)"
  wall-trim: "oklch(0.22 0.03 60)"
  floor: "oklch(0.34 0.06 55)"
  floor-seam: "oklch(0.28 0.05 50)"
  lamp: "oklch(0.78 0.09 70 / 0.35)"
  chair: "oklch(0.42 0.07 50)"
  chair-dark: "oklch(0.3 0.05 45)"
  silhouette: "oklch(0.16 0.02 260)"
typography:
  display:
    fontFamily: "Caveat Variable, cursive"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
  score-total:
    fontFamily: "Caveat Variable, cursive"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: "2.5rem"
    fontFeature: "tnum"
  score-row:
    fontFamily: "Caveat Variable, cursive"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: "1.75rem"
    fontFeature: "tnum"
  title:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
  card-index:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "27cqw"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
rounded:
  paper: "2px"
  ticket: "3px"
  control: "4px"
  card: "6% / 4.3%"
  coaster: "9999px"
  tabletop: "4px"
  chair: "6px 6px 2px 2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  paper-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
    padding: "16px 20px"
  name-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
    padding: "6px 10px"
  playing-card:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.card-black}"
    rounded: "{rounded.card}"
    width: "var(--card-w)"
  playing-card-red:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.card-red}"
    rounded: "{rounded.card}"
  card-back:
    backgroundColor: "{colors.card-back}"
    rounded: "{rounded.ticket}"
  call-ticket:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ticket}"
    padding: "8px 8px 6px"
    width: "64px"
  turn-marker:
    backgroundColor: "{colors.oxblood}"
    textColor: "{colors.card-face}"
    rounded: "{rounded.paper}"
    padding: "4px 12px"
  coaster:
    backgroundColor: "{colors.coaster}"
    textColor: "{colors.oxblood}"
    rounded: "{rounded.coaster}"
    size: "36px"
  button-primary:
    backgroundColor: "{colors.oxblood}"
    textColor: "{colors.card-face}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 10px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 10px"
  button-outline-hover:
    backgroundColor: "{colors.paper-shade}"
---

# Design System: Belot (working title)

## Overview

**Creative North Star: "The Kafana Table"**

The match screen is a kafana room in 2.5D. A dim room (dark green wall, a dark trim, a plank floor, one warm lamp over the table) holds a wooden table, tilted away from the player. A red and white woven gingham cloth covers the table top. The other players sit in chairs behind and beside the table as dark silhouettes, each holding a small fan of card backs. Everything the player reads is an object: white playing cards, oxblood lattice card backs, folded paper name cards, a paper score pad written by hand, a round cardboard coaster that marks the dealer. Ink is a near-black blue. The one accent is oxblood. The world refuses the category default of green casino felt with floating HUD panels.

Objects lie a little askew, as if put down by hand: paper panels rotate between -1.4deg and 1.4deg, trick cards land at -6deg to 5deg, the hand fans on a shallow arc. Density is low. The game state (turn, trump, score, trick) is readable at a glance. The room is the only full-bleed surface; the cloth is the table top only, and the player's own hand stays flat at the bottom edge, outside the tilt.

The world lives behind a skin seam. The cloth, the card back, and the card face are CSS variables on the skin scope, so a host skin (PRODUCT.md: the host picks card face, card back, and table) swaps them without touching components. The silhouette and the chair are the per-player swap point: a player skin later replaces the figure (and its chair) for one seat, not for the table.

**Scope today.** Home and the `rooms/[id]` route (room lobby and match table) are in this world. Home is the kafana menu: a closed menu cover in the room that opens to a house page and a page of public rooms. Sign-in, username, and account still use the stock shadcn neutral theme on `:root` and are not yet migrated. When they move, they move into the same world under the same rules.

**Key Characteristics:**
- A dim kafana room around a tilted wooden table; gingham cloth on the table top only. Nothing is written straight on the cloth.
- The other players are silhouettes in chairs, holding card backs; their names are on paper name cards.
- Paper and cards are the only surfaces that carry text or play, with soft warm shadows; the room around them is dark and quiet.
- Oxblood is the only accent; card red and card black belong to the cards.
- Caveat (handwriting) for what a player would write: titles, scores, the chosen target. Inter for everything printed.
- Objects sit slightly askew, never on a strict axis.
- Skin seam: cloth, card back, card face are host-skin variables; silhouette and chair are the per-player swap point.

## Colors

A cream-and-red tablecloth palette with blue-black ink and one oxblood accent. All values are OKLCH and are declared on the skin scope `:root:has(.table-skin)` in `src/routes/layout.css`; the frontmatter is normative.

### Primary
- **Kafana Oxblood** (`oxblood`): the single accent. Primary buttons, the "your turn" marker, the active-seat outline, the won-trick outline, focus rings, the hand-drawn circle around the chosen target score, the coaster print. Also mapped to `--destructive` and `--ring` inside the skin.

### Card colors (skin seam)
- **Card Face** (`card-face`): the white of playing cards and call tickets; also the text on oxblood.
- **Suit Red** (`card-red`): hearts and diamonds, on card faces and suit pips only.
- **Suit Black** (`card-black`): clubs and spades, on card faces and suit pips only.
- **Lattice Back** (`card-back`, `card-back-line`): the card back field and its 45deg cross-hatch. Defaults to the oxblood value, but it is its own variable so a skin can change it alone.

### Neutral
- **Gingham White** (`cloth`) and **Gingham Thread** (`cloth-thread`): the cloth ground and its woven red threads (2rem repeat, `--cloth-size`).
- **Pad Paper** (`paper`): every panel, name card, pad, notice. Maps to `--background`, `--card`, `--popover` inside the skin.
- **Paper Shade** (`paper-shade`): hover and muted fills on paper (`--muted`, `--accent`).
- **Pad Rule** (`paper-rule`): faint blue ruled lines under score-pad rows.
- **Ink** (`ink`): all text and the score-pad column rule.
- **Soft Ink** (`ink-soft`): secondary text, free seats, carried-over score rows, the dashed "no trump yet" ring.
- **Ink Line** (`ink-line`): borders and input strokes on paper.
- **Coaster Board** (`coaster`): the dealer coaster only.

### Room
The room is dark and warm so the cloth, paper, and cards are the brightest things on screen. All room values are on the same skin scope.
- **Kafana Wall** (`wall`): the dark green upper wall band (top 22% of the room); also the ground of the round portrait on phone name cards. Green is for the wall only, never for the table surface.
- **Wall Trim** (`wall-trim`): the dark band (0.4rem) where wall meets floor.
- **Plank Floor** (`floor`) and **Floor Seam** (`floor-seam`): the floor and the 2px seam between 4.5rem planks.
- **Lamp Glow** (`lamp`): one warm radial pool of light centred on the table, under a dark brown vignette at the room edges.
- **Chair Wood** (`chair`) and **Chair Slat Shadow** (`chair-dark`): the chair back, drawn as vertical slats.
- **Silhouette** (`silhouette`): the seated figure (head and shoulders), with a thin warm rim light from the lamp.

### Named Rules
**The One Accent Rule.** Oxblood is the only accent. Suit red and suit black appear only on cards, suit pips, and call tickets, where they belong to the deck, not to the interface.

**The Skin Seam Rule.** Cloth, card back, and card face are always read through their variables (`--cloth`, `--cloth-thread`, `--card-back`, `--card-back-line`, `--card-face`, `--card-red`, `--card-black`). Never hard-code their values in a component; a host skin must be able to replace them on the skin scope alone. The seated figure and its chair read `--silhouette`, `--chair`, and `--chair-dark` the same way, because a player skin will swap them per seat.

## Typography

**Display Font:** Caveat Variable (with cursive)
**Body Font:** Inter Variable (with sans-serif)

**Character:** Caveat is the pen: what a player at the table would write by hand. Inter is the print: names, rules text, labels, card indices.

### Hierarchy
- **Display** (Caveat 700, 2.25rem, line-height 1): room title, "match over".
- **Score total** (Caveat 700, 1.875rem, 2.5rem line, tabular): the double-ruled totals row of the score pad. The target-score choices in the lobby use the same face at this size.
- **Score row** (Caveat 400, 1.5rem, 1.75rem line, tabular): one row per deal on the pad, the phone score strip, the match result list.
- **Title** (Inter 600, 0.875rem): section heads on paper, player names on name cards.
- **Body** (Inter 400, 0.875rem): status lines, chat, trump line.
- **Label** (Inter 400, 0.75rem, soft ink): card counts, seat and team, "totals to" captions, hints.
- **Card index** (Inter 700, 27% of card width, -0.04em): rank in the card corners, scaled by container query so the card is one unit at any `--card-w`.

### Named Rules
**The Pen and Print Rule.** Caveat only for what is written by hand on the table: titles, scores, the chosen target. Never for instructions, buttons, names, or long text.

## Layout

The match screen is a full-viewport room (`h-svh`, no page scroll). On phone (below 48rem): a paper score strip at the top, then the table. On desktop (48rem and up): the room on the left, a 19rem score-pad column on the right.

The table is the centre of the room, seen in perspective (900px) and tilted away by `--tilt` around a point 60% down the table top: 22deg on phone, 34deg on desktop. The trick lies on the cloth in a 3 by 3 cell grid (each player's card in their own cell), so it tilts with the table. The seats sit around it:
- **Desktop:** partner, left, and right opponents all sit in chairs as silhouettes holding a small card-back fan, with a paper name card below each figure. The partner's chair overlaps the far edge of the table (by 80% of `--seat-w`); the side seats overlap the side edges.
- **Phone:** only the partner sits in a chair, behind the table. The opponents are paper name cards with a round silhouette portrait, at the table's lower-left and lower-right corners, their card-back fans resting on the table edge above them.

The own hand is flat (no tilt), fanned along the bottom edge. Card size is one variable, `--card-w`: `clamp(2.9rem, 12vw, 5.5rem)` on phone for the table, `clamp(3.4rem, 16.5vw, 5.5rem)` for the phone hand, `clamp(4rem, min(7.5vw, 12svh), 7rem)` on desktop. The seated figure is sized by `--seat-w`: 3.5rem on phone, `clamp(4.5rem, 7vw, 6.5rem)` on desktop. Hand overlap is 45% of a card on phone, 18% on desktop. Calls appear as a paper strip of tickets just above the hand.

The lobby is the same room: a tilted table with a face-down deck on it and four seats. On desktop the three seats across and beside the table are chairs (empty chair for a free seat, silhouette for a taken one) with a name card below; your own seat is a name card in front of the table. On phone only the seat across has a chair; the two side seats sit as name cards in a row under the table, then your own. Each name card carries Take seat or Leave seat. To the right (below on phone) is a column of paper panels: room settings, players, chat. Max width 72rem.

Spacing rhythm is Tailwind's 4px step, in practice 4, 8, 12, 16, 20px. Paper padding: 6 by 10px for name cards, 12 by 16px for pads and tickets strips, 16 by 20px for lobby panels.

## Elevation & Depth

Depth is physical. The room gives the large depth: the table tilts away in perspective, the lamp lights its centre, and a dark brown vignette closes the room edges. Paper and cards cast soft, warm shadows tinted toward the cloth's red (hue 25), as if lit from above a real table. Room objects (table, chairs) cast darker brown shadows (hue 40 to 45) onto the floor. There is no flat tonal layering and no glass. Lift is the response to interaction: a playable card or a call ticket rises and its shadow grows.

### Shadow Vocabulary
- **Paper rest** (`box-shadow: 0 1px 1px oklch(0.25 0.08 25 / 0.18), 0 8px 18px -6px oklch(0.25 0.08 25 / 0.45)`): every paper object.
- **Card rest** (`box-shadow: 0 1px 1px oklch(0.25 0.08 25 / 0.25), 0 6px 14px -4px oklch(0.25 0.08 25 / 0.5)`): playing cards.
- **Card lifted** (`box-shadow: 0 2px 2px oklch(0.25 0.08 25 / 0.25), 0 16px 24px -6px oklch(0.25 0.08 25 / 0.55)`): playable card on hover or focus, with an 18% rise.
- **Card back** (`box-shadow: 0 1px 2px oklch(0.25 0.08 25 / 0.4)`): small, close to the cloth.
- **Ticket rest / lifted** (`0 1px 2px oklch(0.25 0.08 25 / 0.2)` / `0 6px 12px -4px oklch(0.25 0.08 25 / 0.45)`): call tickets.
- **Veil** (`background: oklch(0.2 0.06 25 / 0.45)`): the dim over the table behind the match-result paper.
- **Table body** (`box-shadow: 0 0 0 0.5rem oklch(0.35 0.07 45), 0 0.75rem 0 0.5rem oklch(0.24 0.05 40), 0 1.5rem 2rem oklch(0.08 0.02 40 / 0.7)`): the wooden rim around the cloth, the table's front edge below it, and its soft shadow on the floor. The first two layers are the table's own wood, not a shadow.
- **Chair** (`box-shadow: 0 6px 10px oklch(0.1 0.02 40 / 0.6)`): chair back on the wall and floor.
- **Rim light** (`filter: drop-shadow(0 0 1.5px oklch(0.85 0.08 70 / 0.6))`): the lamp's light on the edge of a silhouette, so a dark figure reads against a dark chair.

### Named Rules
**The Lying Flat Rule.** Every shadow is soft and warm (red-brown on the table, darker brown in the room), never grey and never a hard offset. Objects rest on the table or in a player's hands; they do not float. The table's wooden rim and front edge are solid spread layers because they are wood, not shadow; no other object uses that device.

## Shapes

Paper has nearly square corners (2px). Tickets and card backs are 3px. The table top is 4px. The chair back is rounded at the top only (6px over 2px), with vertical slats. The silhouette is one shape: a round head over rounded shoulders; on phone name cards it sits in a round portrait cropped at the shoulders. Controls on paper use 4px (`--radius: 0.25rem` in the skin). Playing cards use a proportional corner (6% / 4.3%) at a 5:7 aspect, so the corner scales with the card. The coaster is the one circle, with printed rings drawn as inset shadows. Hand-drawn marks (the circle around the chosen target score) are SVG strokes with round caps at 2.5px, non-scaling.

Rotation is part of the form language: paper panels sit between -1.4deg and 1.4deg, the coaster at -12deg, trick cards at -6deg to 5deg, the hand on a 3.5deg-per-card fan.

## Components

### Paper
The base surface. Pad paper, ink text, 2px corners, paper-rest shadow. Name cards, the score pad, notices, lobby panels, the call strip, chat, and dialogs in the skin are all paper. Shadcn `Card` used in the world gets the paper treatment with `rounded-[2px] ring-0`.

### Playing Card
Card face, 5:7, proportional corners, rank and suit pip in two opposite corners, one large centre pip (44% width). Suit colour from `card-red` or `card-black`.
- **Playable:** pointer cursor; hover or focus lifts it 18% with the lifted shadow (200ms ease-out).
- **Not playable while others are:** drops 8%, `brightness(0.9) saturate(0.4)`.
- **Won the trick:** 3px oxblood outline, 2px offset.

### Suit Pip
Inline SVG in a 100 by 100 box, `currentColor`. The only way suits are drawn: in cards, the trump line, declarations, call tickets.

### Room
The full-bleed ground of the match screen: wall band, trim, plank floor, the lamp pool over the table, and the vignette. It carries no text; paper sits on top of it.

### Tabletop
The gingham cloth on a wooden table: the cloth fill, a 4px corner, the table-body shadow, tilted by `--tilt` from its parent's perspective. The trick lies on it in the match; the deck lies on it in the lobby.

### Seat
A player at the table. Two forms:
- **Seated** (every other player on desktop, the partner on phone): a chair back behind a silhouette, sized by `--seat-w`, the player's card backs fanned in their hands at the bottom of the figure, and a paper name card below.
- **Name card with portrait** (the opponents on phone): the card backs fan above a paper name card; the card starts with a 28px round portrait (wall-colour ground, silhouette inside).

The name card is small paper with name (title) and card count (label); card backs fan at 7deg steps. The seat whose turn it is gets a 3px oxblood outline at 2px offset on its name card and rises 2px (300ms). The silhouette and chair are the per-player skin point.

### Score Pad
Paper, ruled like a real pad: a blue rule under every row, a 2px ink rule between Us and Them, a 5px double ink rule above the totals. Rows in Caveat; the carried-over row in soft ink. Trump line at the top with a suit pip, or a dashed soft-ink ring while trump is open.

### Call Ticket
A 64px-wide card-face ticket: suit pip (28px) over the suit name. Hover lifts 2px with the ticket-lifted shadow (150ms). "Pass" is an outline button stretched to the ticket height.

### Turn Marker
Solid oxblood slip with card-face text, 2px corners. Shows only on the player's own turn; other turns use a paper slip with the player's name.

### Coaster (dealer mark)
36px circle in coaster board, rotated -12deg, the dealer initial in Caveat oxblood, two printed oxblood rings drawn as inset shadows.

### Target Score Choice
Three numbers in Caveat 1.875rem. The chosen one is bold ink with a hand-drawn oxblood circle around it; the others are soft ink and darken on hover (owner only).

### Menu Cover
Home, closed. A 3:4 oxblood board (`--oxblood`) the size of a real menu (18rem, 20rem on desktop), rotated -1.5deg, with a thin card-face line inset 12px, the four suit pips over the title in Caveat 4.5rem card-face, and "Open the menu" in label size at the bottom. It is one button. Hover straightens it and lifts it 4px (300ms). Its shadow is deeper than paper (`0 24px 40px -12px`), because it is a thick board. The logo is a placeholder until the product has a name.

### Menu Spread
Home, open. Two paper pages side by side (an 18rem house page and the room page), joined at a spine: the house page carries a soft inset shadow on its right edge, and the inner corners are square. On phone the pages stack. The spread enters with a 24px rise (350ms ease-out). The house page holds Create room (primary), the coming features as quiet "Soon" rows, the player name with the account link, and Close the menu.

### Room Menu
The public rooms as a kafana menu. A search field (room owner or player) and a "With a free seat" toggle (oxblood fill when on) sit over sections, one per target score, each headed by a 2px ink rule. A room is a dish: "Room of <room owner>" in title weight, a dotted leader, and the price (the table's average rating) in Caveat 1.5rem; the seated players and free seats are a label line under it. The whole row is the link; hover fills it with paper shade. Ratings are made up until ranked play exists.

### Buttons
Shadcn buttons, re-coloured by the skin.
- **Shape:** 4px corners.
- **Primary:** oxblood fill, card-face text, 32px high (36px large, 28px small); hover at 80% fill.
- **Outline:** paper fill, ink-line border; hover to paper shade.
- **Ghost:** no fill; hover to paper shade.
- **Destructive:** oxblood text on a 10% oxblood tint.
- **Disabled:** 50% opacity.

### Inputs
Shadcn input on paper: ink-line stroke, 4px corners, oxblood focus ring.

## Do's and Don'ts

### Do:
- **Do** put every word on paper or a card. The cloth and the room carry objects only (cards, card backs, paper, figures, chairs).
- **Do** read cloth, card back, and card face through their skin variables, and scope new table surfaces with `.table-skin`.
- **Do** draw another player as the silhouette (in a chair where there is room), and read its colours through `--silhouette`, `--chair`, `--chair-dark`.
- **Do** put what lies on the table (the trick) inside the tilted table top, and keep the own hand and all paper flat.
- **Do** use the paper-rest shadow for any new paper object and tilt it a little (within 1.5deg).
- **Do** use Caveat for scores and handwritten titles, Inter for everything else.
- **Do** mark state with oxblood: the outline for turn and won trick, the solid slip for "your turn", the circle for a choice.
- **Do** size anything card-like from `--card-w`, and seated figures from `--seat-w`.

### Don't:
- **Don't** use green felt, HUD panels, or glass; this is a kafana table, not a casino. The green is the wall, never the table surface.
- **Don't** add a second accent colour. Suit red is for the deck only.
- **Don't** write text straight on the cloth.
- **Don't** use grey or hard-offset shadows.
- **Don't** draw suits with text glyphs; use the suit pip SVG.
- **Don't** hard-code a skin colour in a component.
