# Generic engine with pure-function rulesets

The engine is generic from the start: each card game is a ruleset, a plain object of pure functions (`setup`, `legalMoves`, `apply`, `view`, `result`) over plain JSON state, with players referenced by seat number. We chose this over the earlier object-oriented classes because server-authoritative play (ADR 0001) needs state that serialises cleanly for sending views, saving, and replay, and because other card games are planned after belot.
