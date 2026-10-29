import { Elysia } from 'elysia';
import type { ChatIntent } from '#src/chat';
import { roomParams } from '#src/modules/rooms/model';
import type { Socket, Sockets } from '#src/modules/sockets/service';
import type { MatchIntent } from '#src/play';
import type { Member, Session } from '#src/plugins/session';
import type { RoomView } from '#src/modules/rooms/service';

export type SocketHandlers = {
  // The room as its members see it; undefined when the user is not one.
  room: (member: Member) => Promise<RoomView | undefined>;
  // Catches a socket that just opened up on the room's match.
  opened: (socket: Socket) => void;
  // `move` comes from a client and may have any shape.
  move: (socket: Socket, move: object) => Promise<void>;
  end: (socket: Socket) => Promise<void>;
  chat: (socket: Socket, intent: ChatIntent) => void;
  // The user's last socket in the room closed.
  lastClosed: (member: Member) => Promise<void>;
};

export const socketRoutes = (
  session: Session,
  sockets: Sockets,
  handlers: SocketHandlers,
) => {
  // Opening a socket reads the room first. Messages and the close that come
  // meanwhile wait for it, by connection id.
  const opening = new Map<string, Promise<void>>();

  return new Elysia({ prefix: '/rooms' }).use(session).ws('/:id/ws', {
    player: true,
    params: roomParams,
    open(ws) {
      const member = { roomId: ws.data.params.id, userId: ws.data.userId };
      const open = async () => {
        const room = await handlers.room(member);
        if (!room) return ws.close(4403, 'not_a_member');
        const socket: Socket = {
          ...member,
          id: ws.id,
          send: (message) => ws.send(JSON.stringify(message)),
          close: () => ws.close(),
        };
        sockets.add(socket);
        socket.send({ type: 'room', room });
        handlers.opened(socket);
      };
      const opened = open();
      opening.set(ws.id, opened);
      return opened;
    },
    async message(ws, body) {
      await opening.get(ws.id);
      // Elysia parses JSON messages; anything else is not an intent.
      const intent = (typeof body === 'object' ? body : null) as Partial<
        ChatIntent | MatchIntent
      > | null;
      const socket = sockets.get(ws.data.params.id, ws.id);
      if (!socket) return;
      if (intent?.type === 'match.move') {
        await handlers.move(socket, intent.move ?? {});
      } else if (intent?.type === 'match.end') {
        await handlers.end(socket);
      } else if (String(intent?.type).startsWith('chat.')) {
        handlers.chat(socket, intent as ChatIntent);
      }
    },
    async close(ws) {
      await opening.get(ws.id);
      opening.delete(ws.id);
      if (sockets.remove(ws.data.params.id, ws.id)) {
        await handlers.lastClosed({
          roomId: ws.data.params.id,
          userId: ws.data.userId,
        });
      }
    },
  });
};
