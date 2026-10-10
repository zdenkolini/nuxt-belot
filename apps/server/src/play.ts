import {
  belot,
  type BelotEvent,
  type BelotMove,
  type BelotResult,
  type BelotState,
  type BelotVariant,
  type BelotView,
  type Logged,
  type Seat,
} from '@belot/engine';

// What one seat sees of the match. `events` are those of the last move.
export type MatchView = {
  seat: Seat;
  view: BelotView;
  legalMoves: BelotMove[];
  turn: Seat | null;
  events: BelotEvent[];
  result: BelotResult | null;
};

export type MatchMessage =
  | { type: 'match'; match: MatchView }
  | { type: 'match.rejected'; reason: MoveRejection };

export type MatchIntent = { type: 'match.move'; move: BelotMove };

type Untrusted = { type: unknown; suit: unknown; card?: { id?: unknown } };

export type MoveRejection =
  'no_match' | 'not_seated' | 'not_your_turn' | 'illegal_move';

// Everything needed to rebuild a match with `replay`, plus the live state.
type LiveMatch = {
  variant: BelotVariant;
  seed: number;
  seats: string[];
  log: Logged<BelotMove>[];
  state: BelotState;
};

const seats = [0, 1, 2, 3] as const;

const cryptoSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

// The one place that holds live matches, by room id.
export const createPlay = () => {
  const matches = new Map<string, LiveMatch>();

  const viewOf = (match: LiveMatch, seat: Seat, events: BelotEvent[]) => ({
    seat,
    view: belot.view(match.state, seat),
    legalMoves: belot.legalMoves(match.state, seat),
    turn:
      seats.find((s) => belot.legalMoves(match.state, s).length > 0) ?? null,
    events,
    result: belot.result(match.state),
  });

  // The match message for each seated user, keyed by user id.
  const views = (match: LiveMatch, events: BelotEvent[]) =>
    new Map(
      match.seats.map((userId, seat) => [
        userId,
        { type: 'match', match: viewOf(match, seat as Seat, events) } as const,
      ]),
    );

  return {
    isRunning: (roomId: string) => {
      const match = matches.get(roomId);
      return !!match && !belot.result(match.state);
    },

    start: (roomId: string, seatedUsers: string[], variant: BelotVariant) => {
      const seed = cryptoSeed();
      const match: LiveMatch = {
        variant,
        seed,
        seats: seatedUsers,
        log: [],
        state: belot.setup(variant, 4, seed),
      };
      matches.set(roomId, match);
      return views(match, []);
    },

    // `move` comes from a client and may have any shape.
    move: (roomId: string, userId: string, move: Partial<Untrusted>) => {
      const match = matches.get(roomId);
      if (!match) return { ok: false, reason: 'no_match' } as const;
      const index = match.seats.indexOf(userId);
      if (index < 0) return { ok: false, reason: 'not_seated' } as const;
      const seat = index as Seat;
      const legal = belot.legalMoves(match.state, seat);
      if (legal.length === 0) {
        return { ok: false, reason: 'not_your_turn' } as const;
      }
      const chosen = legal.find(
        (l) =>
          l.type === move.type &&
          (l.type !== 'call' || l.suit === move.suit) &&
          (l.type !== 'play' || l.card.id === move.card?.id),
      );
      if (!chosen) return { ok: false, reason: 'illegal_move' } as const;
      const applied = belot.apply(match.state, seat, chosen);
      if (!applied.ok) throw new Error(applied.reason);
      match.state = applied.state;
      match.log.push({ seat, move: chosen });
      return { ok: true, views: views(match, applied.events) } as const;
    },

    // The current match message for one user, if they have a seat in it.
    viewFor: (roomId: string, userId: string): MatchMessage | undefined => {
      const match = matches.get(roomId);
      return match && views(match, []).get(userId);
    },
  };
};
