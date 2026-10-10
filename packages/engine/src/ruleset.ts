export type Seat = 0 | 1 | 2 | 3;

export type Applied<State, Event> =
  { ok: true; state: State; events: Event[] } | { ok: false; reason: string };

export type Ruleset<Variant, State, Move, Event, View, Result> = {
  setup: (variant: Variant, seats: number, seed: string) => State;
  legalMoves: (state: State, seat: Seat) => Move[];
  apply: (state: State, seat: Seat, move: Move) => Applied<State, Event>;
  view: (state: State, seat: Seat) => View;
  result: (state: State) => Result | null;
};

export type Logged<Move> = { seat: Seat; move: Move };

// Rebuilds a match from its seed, variant, and move log.
// Returns the final state and every event, or the first rejection.
export const replay = <Variant, State, Move, Event>(
  ruleset: Ruleset<Variant, State, Move, Event, unknown, unknown>,
  variant: Variant,
  seats: number,
  seed: string,
  moves: Logged<Move>[],
): Applied<State, Event> => {
  let state = ruleset.setup(variant, seats, seed);
  const events: Event[] = [];
  for (const { seat, move } of moves) {
    const applied = ruleset.apply(state, seat, move);
    if (!applied.ok) return applied;
    state = applied.state;
    events.push(...applied.events);
  }
  return { ok: true, state, events };
};
