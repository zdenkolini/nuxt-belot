export type Seat = 0 | 1 | 2 | 3;

export type Applied<State, Event> =
  { ok: true; state: State; events: Event[] } | { ok: false; reason: string };

export type Ruleset<Variant, State, Move, Event, View, Result> = {
  setup: (variant: Variant, seats: number, seed: number) => State;
  legalMoves: (state: State, seat: Seat) => Move[];
  apply: (state: State, seat: Seat, move: Move) => Applied<State, Event>;
  view: (state: State, seat: Seat) => View;
  result: (state: State) => Result | null;
};
