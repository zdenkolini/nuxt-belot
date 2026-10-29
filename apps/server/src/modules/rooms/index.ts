import { Elysia } from 'elysia';
import {
  addBotErrors,
  changeErrors,
  freeSeatErrors,
  joinErrors,
  leaveErrors,
  memberParams,
  removeMemberErrors,
  roomParams,
  seatBody,
  settingsBody,
  startErrors,
  takeSeatErrors,
} from '#src/modules/rooms/model';
import type { Rooms } from '#src/modules/rooms/service';
import type { Session } from '#src/plugins/session';

export const roomRoutes = (session: Session, rooms: Rooms) =>
  new Elysia({ prefix: '/rooms' })
    .use(session)
    .get('/', () => rooms.list(), { player: true })
    .post('/', ({ userId }) => rooms.create(userId), { player: true })
    .post('/:id/join', ({ userId, params: { id } }) => rooms.join(id, userId), {
      player: true,
      params: roomParams,
      response: joinErrors,
    })
    .post(
      '/:id/leave',
      ({ userId, params: { id } }) => rooms.leave(id, userId),
      {
        player: true,
        params: roomParams,
        response: leaveErrors,
      },
    )
    .put(
      '/:id/seat',
      ({ userId, params: { id }, body: { seat } }) =>
        rooms.takeSeat(id, userId, seat),
      {
        player: true,
        params: roomParams,
        body: seatBody,
        response: takeSeatErrors,
      },
    )
    .delete(
      '/:id/seat',
      ({ userId, params: { id } }) => rooms.freeSeat(id, userId),
      { player: true, params: roomParams, response: freeSeatErrors },
    )
    .patch(
      '/:id',
      ({ userId, params: { id }, body }) => rooms.change(id, userId, body),
      {
        player: true,
        params: roomParams,
        body: settingsBody,
        response: changeErrors,
      },
    )
    .delete(
      '/:id/members/:userId',
      ({ userId, params: { id, userId: member } }) =>
        rooms.removeMember(id, userId, member),
      { player: true, params: memberParams, response: removeMemberErrors },
    )
    .post(
      '/:id/bots',
      ({ userId, params: { id }, body: { seat } }) =>
        rooms.addBot(id, userId, seat),
      {
        player: true,
        params: roomParams,
        body: seatBody,
        response: addBotErrors,
      },
    )
    .post(
      '/:id/start',
      ({ userId, params: { id } }) => rooms.start(id, userId),
      { player: true, params: roomParams, response: startErrors },
    );
