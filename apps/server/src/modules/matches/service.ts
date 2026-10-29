import assert from 'node:assert';
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
import { isBot } from '#src/bots';
import { usernames } from '#src/modules/account/service';
import type { Member } from '#src/plugins/session';

// What one seat sees of the match. `players` are by seat, also those who
// left the room. `events` are those of the last move. `missing` holds the user ids of seated players who are not connected; the
// match is paused while it is not empty. `ended` is true when the players
// ended a paused match or one abandoned it; `abandonedBy` names who abandoned.
export type MatchView = {
  seat: Seat;
  players: Player[];
  view: BelotView;
  legalMoves: BelotMove[];
  turn: Seat | null;
  events: BelotEvent[];
  result: BelotResult | null;
  missing: string[];
  ended: boolean;
  abandonedBy: string | null;
};

export type MatchMessage =
  | { type: 'match'; match: MatchView }
  | { type: 'match.rejected'; reason: MoveRejection };

export type MatchIntent =
  { type: 'match.move'; move: BelotMove } | { type: 'match.end' };

export type MoveRejection =
  | 'no_match'
  | 'not_seated'
  | 'not_your_turn'
  | 'illegal_move'
  | 'paused'
  | 'not_paused';

export class MatchRejected extends Error {
  constructor(readonly code: MoveRejection) {
    super(code);
  }
}

type Player = { id: string; username: string | null };

// Everything needed to rebuild a match with `replay`, plus the live state.
type LiveMatch = {
  id: string;
  ended: boolean;
  abandonedBy: string | null;
  variant: BelotVariant;
  seed: string;
  // Kept from the start, so players who leave the room keep their name.
  players: Player[];
  log: Logged<BelotMove>[];
  state: BelotState;
};

const seats = [0, 1, 2, 3] as const;

export const isSeat = (index: number): index is Seat =>
  seats.some((seat) => seat === index);

// The player's seat, if they have one.
export const seatFor = (players: Player[], userId: string) => {
  const seat = players.findIndex((p) => p.id === userId);
  if (!isSeat(seat)) return undefined;
  return seat;
};

export const turnOf = (state: BelotState) =>
  seats.find((seat) => belot.legalMoves(state, seat).length > 0) ?? null;

export const missingOf = (seated: string[], online: Set<string>) =>
  seated.filter((userId) => !online.has(userId) && !isBot(userId));

// 128 random bits as 32 hex digits.
const cryptoSeed = () => crypto.getRandomValues(new Uint8Array(16)).toHex();

const playersOf = async (db: Db, ids: string[]) => {
  const names = await usernames(db, ids);
  return ids.map((id) => ({ id, username: names.get(id) ?? null }));
};

// The matches table holds any ruleset, so its variant and moves are untyped;
// only belot is saved.
const rebuild = async (db: Db, saved: typeof matchesTable.$inferSelect) => {
  const log = (await db
    .select({ seat: moves.seat, move: moves.move })
    .from(moves)
    .where(eq(moves.matchId, saved.id))
    .orderBy(asc(moves.index))) as Logged<BelotMove>[];
  const variant = saved.variant as BelotVariant;
  const rebuilt = replay(belot, variant, saved.seed, log);
  if (!rebuilt.ok) throw new Error(`match ${saved.id}: ${rebuilt.reason}`);
  return {
    id: saved.id,
    ended: false,
    abandonedBy: null,
    variant,
    seed: saved.seed,
    players: await playersOf(db, saved.seats),
    log,
    state: rebuilt.state,
  };
};

const isOver = (match: LiveMatch) => match.ended || !!belot.result(match.state);

const viewOf = (
  match: LiveMatch,
  seat: Seat,
  events: BelotEvent[],
  missing: string[],
): MatchView => {
  const view = {
    seat,
    players: match.players,
    view: belot.view(match.state, seat),
    legalMoves: belot.legalMoves(match.state, seat),
    turn: turnOf(match.state),
    events,
    result: belot.result(match.state),
    missing,
    ended: match.ended,
    abandonedBy: match.abandonedBy,
  };
  if (match.ended) return { ...view, legalMoves: [], turn: null };
  return view;
};

// The one place that holds live matches, by room id. Each match and its
// moves are saved as they happen; running matches are rebuilt on start.
// `connected` gives the user ids with an open socket in a room.
export const createMatches = async (
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
    assert(saved.roomId);
    matches.set(saved.roomId, await rebuild(db, saved));
  }

  const missingIn = (roomId: string, match: LiveMatch) => {
    if (isOver(match)) return [];
    return missingOf(
      match.players.map((p) => p.id),
      connected(roomId),
    );
  };

  // The match message for each seated user, keyed by user id.
  const views = (roomId: string, match: LiveMatch, events: BelotEvent[]) => {
    const missing = missingIn(roomId, match);
    return new Map(
      seats.map((seat) => {
        const player = match.players[seat];
        assert(player);
        const message = {
          type: 'match',
          match: viewOf(match, seat, events, missing),
        } as const;
        return [player.id, message];
      }),
    );
  };

  const runningMatch = (roomId: string) => {
    const match = matches.get(roomId);
    if (!match || isOver(match)) return undefined;
    return match;
  };

  const seatIn = (match: LiveMatch, userId: string) => {
    const seat = seatFor(match.players, userId);
    if (seat === undefined) throw new MatchRejected('not_seated');
    return seat;
  };

  return {
    isRunning: (roomId: string) => !!runningMatch(roomId),

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
      assert(saved);
      const match: LiveMatch = {
        id: saved.id,
        ended: false,
        abandonedBy: null,
        variant,
        seed,
        players: await playersOf(db, seatedUsers),
        log: [],
        state: belot.setup(variant, seed),
      };
      matches.set(roomId, match);
      return views(roomId, match, []);
    },

    // `move` comes from a client and may have any shape.
    move: async ({ roomId, userId }: Member, move: object) => {
      const match = matches.get(roomId);
      if (!match) throw new MatchRejected('no_match');
      const seat = seatIn(match, userId);
      if (missingIn(roomId, match).length > 0) {
        throw new MatchRejected('paused');
      }
      if (belot.legalMoves(match.state, seat).length === 0) {
        throw new MatchRejected('not_your_turn');
      }
      const applied = belot.apply(match.state, seat, move as BelotMove);
      if (!applied.ok) throw new MatchRejected('illegal_move');
      match.state = applied.state;
      match.log.push({ seat, move: move as BelotMove });
      await db.insert(moves).values({
        matchId: match.id,
        index: match.log.length - 1,
        seat,
        move,
      });
      const result = belot.result(match.state);
      if (result) {
        await db
          .update(matchesTable)
          .set({ status: 'finished', result })
          .where(eq(matchesTable.id, match.id));
      }
      return views(roomId, match, applied.events);
    },

    // Any seated player may end a paused match for everyone.
    end: async ({ roomId, userId }: Member) => {
      const match = runningMatch(roomId);
      if (!match) throw new MatchRejected('no_match');
      seatIn(match, userId);
      if (missingIn(roomId, match).length === 0) {
        throw new MatchRejected('not_paused');
      }
      match.ended = true;
      await db
        .update(matchesTable)
        .set({ status: 'ended' })
        .where(eq(matchesTable.id, match.id));
      return views(roomId, match, []);
    },

    // A seated player leaves a running match on purpose: it ends for everyone.
    abandon: async ({ roomId, userId }: Member) => {
      const match = matches.get(roomId);
      assert(match);
      match.ended = true;
      match.abandonedBy = userId;
      await db
        .update(matchesTable)
        .set({ status: 'abandoned' })
        .where(eq(matchesTable.id, match.id));
      return views(roomId, match, []);
    },

    // The current match message for each seated user, keyed by user id.
    viewsOf: (roomId: string) => {
      const match = matches.get(roomId);
      if (!match) return new Map<string, MatchMessage>();
      return views(roomId, match, []);
    },

    // The current match message for one user, if they have a seat in it.
    viewFor: ({ roomId, userId }: Member): MatchMessage | undefined => {
      const match = matches.get(roomId);
      return match && views(roomId, match, []).get(userId);
    },

    // The user's seat in the room's unfinished match, if they have one.
    seatOf: ({ roomId, userId }: Member) => {
      const match = runningMatch(roomId);
      if (!match) return undefined;
      return seatFor(match.players, userId);
    },
  };
};
