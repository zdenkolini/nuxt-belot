import { matches as matchesTable, moves, type Db } from '@belot/db';
import {
  belot,
  replay,
  type BelotEvent,
  type BelotMove,
  type BelotResult,
  type BelotState,
  type BelotVariant,
  type BelotView,
  type Logged,
  type Seat,
} from '@belot/engine';
import { and, asc, eq, isNotNull } from 'drizzle-orm';

// What one seat sees of the match. `events` are those of the last move.
// `missing` holds the user ids of seated players who are not connected; the
// match is paused while it is not empty. `ended` is true when the players
// ended a paused match.
export type MatchView = {
  seat: Seat;
  view: BelotView;
  legalMoves: BelotMove[];
  turn: Seat | null;
  events: BelotEvent[];
  result: BelotResult | null;
  missing: string[];
  ended: boolean;
};

export type MatchMessage =
  | { type: 'match'; match: MatchView }
  | { type: 'match.rejected'; reason: MoveRejection };

export type MatchIntent =
  { type: 'match.move'; move: BelotMove } | { type: 'match.end' };

type Untrusted = { type: unknown; suit: unknown; card?: { id?: unknown } };

export type MoveRejection =
  | 'no_match'
  | 'not_seated'
  | 'not_your_turn'
  | 'illegal_move'
  | 'paused'
  | 'not_paused';

// Everything needed to rebuild a match with `replay`, plus the live state.
type LiveMatch = {
  id: string;
  ended: boolean;
  variant: BelotVariant;
  seed: number;
  seats: string[];
  log: Logged<BelotMove>[];
  state: BelotState;
};

const seats = [0, 1, 2, 3] as const;

const cryptoSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

// The one place that holds live matches, by room id. Each match and its
// moves are saved as they happen; running matches are rebuilt on start.
// `connected` gives the user ids with an open socket in a room.
export const createPlay = async (
  db: Db,
  connected: (roomId: string) => Set<string>,
) => {
  const matches = new Map<string, LiveMatch>();

  const running = await db
    .select()
    .from(matchesTable)
    .where(
      and(eq(matchesTable.status, 'running'), isNotNull(matchesTable.roomId)),
    );
  for (const saved of running) {
    const log = (await db
      .select({ seat: moves.seat, move: moves.move })
      .from(moves)
      .where(eq(moves.matchId, saved.id))
      .orderBy(asc(moves.index))) as Logged<BelotMove>[];
    const variant = saved.variant as BelotVariant;
    const rebuilt = replay(belot, variant, 4, saved.seed, log);
    if (!rebuilt.ok) throw new Error(`match ${saved.id}: ${rebuilt.reason}`);
    matches.set(saved.roomId!, {
      id: saved.id,
      ended: false,
      variant,
      seed: saved.seed,
      seats: saved.seats,
      log,
      state: rebuilt.state,
    });
  }

  const isOver = (match: LiveMatch) =>
    match.ended || !!belot.result(match.state);

  const missingIn = (roomId: string, match: LiveMatch) => {
    if (isOver(match)) return [];
    const online = connected(roomId);
    return match.seats.filter((userId) => !online.has(userId));
  };

  const viewOf = (
    match: LiveMatch,
    seat: Seat,
    events: BelotEvent[],
    missing: string[],
  ): MatchView => {
    const legalMoves = match.ended ? [] : belot.legalMoves(match.state, seat);
    return {
      seat,
      view: belot.view(match.state, seat),
      legalMoves,
      turn: match.ended
        ? null
        : (seats.find((s) => belot.legalMoves(match.state, s).length > 0) ??
          null),
      events,
      result: belot.result(match.state),
      missing,
      ended: match.ended,
    };
  };

  // The match message for each seated user, keyed by user id.
  const views = (roomId: string, match: LiveMatch, events: BelotEvent[]) => {
    const missing = missingIn(roomId, match);
    return new Map(
      match.seats.map((userId, seat) => [
        userId,
        {
          type: 'match',
          match: viewOf(match, seat as Seat, events, missing),
        } as const,
      ]),
    );
  };

  return {
    isRunning: (roomId: string) => {
      const match = matches.get(roomId);
      return !!match && !isOver(match);
    },

    start: async (
      roomId: string,
      seatedUsers: string[],
      variant: BelotVariant,
    ) => {
      const seed = cryptoSeed();
      const [saved] = await db
        .insert(matchesTable)
        .values({
          roomId,
          ruleset: 'belot',
          variant,
          seats: seatedUsers,
          seed,
        })
        .returning({ id: matchesTable.id });
      const match: LiveMatch = {
        id: saved!.id,
        ended: false,
        variant,
        seed,
        seats: seatedUsers,
        log: [],
        state: belot.setup(variant, 4, seed),
      };
      matches.set(roomId, match);
      return views(roomId, match, []);
    },

    // `move` comes from a client and may have any shape.
    move: async (roomId: string, userId: string, move: Partial<Untrusted>) => {
      const match = matches.get(roomId);
      if (!match) return { ok: false, reason: 'no_match' } as const;
      const index = match.seats.indexOf(userId);
      if (index < 0) return { ok: false, reason: 'not_seated' } as const;
      if (missingIn(roomId, match).length > 0) {
        return { ok: false, reason: 'paused' } as const;
      }
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
      await db.insert(moves).values({
        matchId: match.id,
        index: match.log.length - 1,
        seat,
        move: chosen,
      });
      const result = belot.result(match.state);
      if (result) {
        await db
          .update(matchesTable)
          .set({ status: 'finished', result })
          .where(eq(matchesTable.id, match.id));
      }
      return { ok: true, views: views(roomId, match, applied.events) } as const;
    },

    // Any seated player may end a paused match for everyone.
    end: async (roomId: string, userId: string) => {
      const match = matches.get(roomId);
      if (!match || isOver(match)) {
        return { ok: false, reason: 'no_match' } as const;
      }
      if (!match.seats.includes(userId)) {
        return { ok: false, reason: 'not_seated' } as const;
      }
      if (missingIn(roomId, match).length === 0) {
        return { ok: false, reason: 'not_paused' } as const;
      }
      match.ended = true;
      await db
        .update(matchesTable)
        .set({ status: 'ended' })
        .where(eq(matchesTable.id, match.id));
      return { ok: true, views: views(roomId, match, []) } as const;
    },

    // The current match message for each seated user, keyed by user id.
    viewsOf: (roomId: string) => {
      const match = matches.get(roomId);
      return match ? views(roomId, match, []) : new Map<string, MatchMessage>();
    },

    // The current match message for one user, if they have a seat in it.
    viewFor: (roomId: string, userId: string): MatchMessage | undefined => {
      const match = matches.get(roomId);
      return match && views(roomId, match, []).get(userId);
    },

    // True when the user has a seat in the room's unfinished match.
    isSeated: (roomId: string, userId: string) => {
      const match = matches.get(roomId);
      return !!match && !isOver(match) && match.seats.includes(userId);
    },
  };
};
