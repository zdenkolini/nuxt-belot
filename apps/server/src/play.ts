import { matches as matchesTable, moves, user, type Db } from '@belot/db';
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
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { isBot } from '#src/bots';
import type { Member } from '#src/session';

// What one seat sees of the match. `players` are by seat, also those who
// left the room. `events` are those of the last move. `missing` holds the user ids of seated players who are not connected; the
// match is paused while it is not empty. `ended` is true when the players
// ended a paused match or one abandoned it; `abandonedBy` names who abandoned.
export type MatchView = {
  seat: Seat;
  players: { id: string; username: string | null }[];
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

// Everything needed to rebuild a match with `replay`, plus the live state.
type LiveMatch = {
  id: string;
  ended: boolean;
  abandonedBy: string | null;
  variant: BelotVariant;
  seed: string;
  seats: string[];
  // Kept from the start, so players who leave the room keep their name.
  usernames: (string | null)[];
  log: Logged<BelotMove>[];
  state: BelotState;
};

const seats = [0, 1, 2, 3] as const;

// 128 random bits as 32 hex digits.
const cryptoSeed = () => crypto.getRandomValues(new Uint8Array(16)).toHex();

// The one place that holds live matches, by room id. Each match and its
// moves are saved as they happen; running matches are rebuilt on start.
// `connected` gives the user ids with an open socket in a room.
export const createPlay = async (
  db: Db,
  connected: (roomId: string) => Set<string>,
) => {
  const matches = new Map<string, LiveMatch>();

  const usernamesOf = async (ids: string[]) => {
    const names = await db
      .select({ id: user.id, username: user.username })
      .from(user)
      .where(inArray(user.id, ids));
    return ids.map((id) => names.find((n) => n.id === id)?.username ?? null);
  };

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
    const rebuilt = replay(belot, variant, saved.seed, log);
    if (!rebuilt.ok) throw new Error(`match ${saved.id}: ${rebuilt.reason}`);
    matches.set(saved.roomId!, {
      id: saved.id,
      ended: false,
      abandonedBy: null,
      variant,
      seed: saved.seed,
      seats: saved.seats,
      usernames: await usernamesOf(saved.seats),
      log,
      state: rebuilt.state,
    });
  }

  const isOver = (match: LiveMatch) =>
    match.ended || !!belot.result(match.state);

  const missingIn = (roomId: string, match: LiveMatch) => {
    if (isOver(match)) return [];
    const online = connected(roomId);
    return match.seats.filter(
      (userId) => !online.has(userId) && !isBot(userId),
    );
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
      players: match.seats.map((id, i) => ({
        id,
        username: match.usernames[i]!,
      })),
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
      abandonedBy: match.abandonedBy,
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
        abandonedBy: null,
        variant,
        seed,
        seats: seatedUsers,
        usernames: await usernamesOf(seatedUsers),
        log: [],
        state: belot.setup(variant, seed),
      };
      matches.set(roomId, match);
      return views(roomId, match, []);
    },

    // `move` comes from a client and may have any shape.
    move: async ({ roomId, userId }: Member, move: object) => {
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
      const applied = belot.apply(match.state, seat, move as BelotMove);
      if (!applied.ok) return { ok: false, reason: 'illegal_move' } as const;
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
      return { ok: true, views: views(roomId, match, applied.events) } as const;
    },

    // Any seated player may end a paused match for everyone.
    end: async ({ roomId, userId }: Member) => {
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

    // A seated player leaves a running match on purpose: it ends for everyone.
    abandon: async ({ roomId, userId }: Member) => {
      const match = matches.get(roomId)!;
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
      return match ? views(roomId, match, []) : new Map<string, MatchMessage>();
    },

    // The current match message for one user, if they have a seat in it.
    viewFor: ({ roomId, userId }: Member): MatchMessage | undefined => {
      const match = matches.get(roomId);
      return match && views(roomId, match, []).get(userId);
    },

    // The user's seat in the room's unfinished match, if they have one.
    seatOf: ({ roomId, userId }: Member) => {
      const match = matches.get(roomId);
      const seat = match && !isOver(match) ? match.seats.indexOf(userId) : -1;
      return seat < 0 ? undefined : seat;
    },
  };
};
