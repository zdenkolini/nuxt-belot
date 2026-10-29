import { t } from 'elysia';
import { errorBody } from '#src/plugins/errors';

export const roomParams = t.Object({ id: t.String({ format: 'uuid' }) });

export const memberParams = t.Object({
  ...roomParams.properties,
  userId: t.String(),
});

export const seatBody = t.Object({
  seat: t.Integer({ minimum: 0, maximum: 3 }),
});

// The engine's target scores. A literal tuple, as Eden loses the literal
// types of a mapped array; t.UnionEnum would default a missing one to 501.
const targetScore = t.Union([t.Literal(501), t.Literal(701), t.Literal(1001)]);

export const settingsBody = t.Object({
  isPublic: t.Optional(t.Boolean()),
  targetScore: t.Optional(targetScore),
});

export type Settings = typeof settingsBody.static;

// The `player` session macro also answers 403.
const forbidden = <const Code extends string>(code: Code) =>
  t.Union([errorBody('username_required'), errorBody(code)]);

const roomNotFound = errorBody('room_not_found');
const notAMember = forbidden('not_a_member');
const notTheOwner = forbidden('not_the_owner');
const matchRunning = errorBody('match_running');
const seatTaken = errorBody('seat_taken');

export const joinErrors = {
  403: forbidden('removed_from_room'),
  404: roomNotFound,
};

export const leaveErrors = { 403: notAMember, 404: roomNotFound };

export const takeSeatErrors = {
  403: notAMember,
  404: roomNotFound,
  409: t.Union([matchRunning, seatTaken, errorBody('seated_in_match')]),
};

export const freeSeatErrors = {
  403: notAMember,
  404: roomNotFound,
  409: matchRunning,
};

export const changeErrors = { 403: notTheOwner, 404: roomNotFound };

export const removeMemberErrors = {
  403: notTheOwner,
  404: t.Union([roomNotFound, errorBody('member_not_found')]),
};

export const addBotErrors = {
  403: notTheOwner,
  404: t.Union([roomNotFound, errorBody('bots_disabled')]),
  409: t.Union([matchRunning, seatTaken, errorBody('no_bot_left')]),
};

export const startErrors = {
  403: notTheOwner,
  404: roomNotFound,
  409: t.Union([matchRunning, errorBody('seats_not_full')]),
};
