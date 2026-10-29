---
version: 1
slug: 'src-routes-rooms-id-page-svelte'
primary_target: 'src/routes/rooms/[id]/+page.svelte'
related_targets: ['src/lib/components/match/match-screen.svelte']
---

# Room and game table (rooms/[id])

Scope: the room lobby and the match table on one route. Mode: Operate. Players play many deals in an evening, on a phone in portrait or on a desktop. Task: read the hand, the trick, the turn, trump, and the score at a glance; call trump; play a card. Lobby task: take a seat, set the target score, share the invite, start.

Constraints: copy through paraglide; GLOSSARY terms; skins later swap table cloth, card back, and card face, so these three are CSS variables on a skin scope. No deal history on the server: the score pad lists the deals seen this session and carries the rest in one row.

## Direction contract

THESIS: The screen is a kafana table seen from above. Refuses the category default of a green casino felt with floating HUD panels.

OWN-WORLD: Red and white woven gingham fills the viewport. Objects lie on it: white cards with oxblood lattice backs, folded paper name cards, a paper score pad, a round cardboard coaster as the dealer mark. Ink is near-black blue; the only accent is oxblood. Nothing is written straight on the cloth.

STORY: The player sees whose turn it is, what trump is, and how far each team is from the target, then plays. Between deals the pad gets a new written row.

FIRST VIEWPORT: Cloth full-bleed. Partner's name card top centre, opponents left and right, trick cross in the centre, own hand fanned at the bottom edge at full card size. Score pad: right side on desktop, slim paper strip at top on phone that opens to the full pad. Calls: paper tickets above the hand.

FORM: user-pinned kafana checkered tablecloth; beats roll ae1e7fb9 (assigned index 5, challengers declined).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
