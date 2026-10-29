import type { ChatServerMessage } from '#src/modules/chat/service';
import type { MatchMessage } from '#src/modules/matches/service';
import type { Member } from '#src/plugins/session';
import type { RoomView } from '#src/modules/rooms/service';

// Everything the server sends over the room socket.
export type RoomMessage =
  | { type: 'room'; room: RoomView }
  | { type: 'removed' }
  | MatchMessage
  | ChatServerMessage;

// One open room socket; `id` is its connection id.
export type Socket = Member & {
  id: string;
  send: (message: RoomMessage) => void;
  close: () => void;
};

// The one place that holds open room sockets, by room id, then by connection id.
export const createSockets = () => {
  const rooms = new Map<string, Map<string, Socket>>();

  const inRoom = (roomId: string) => [...(rooms.get(roomId)?.values() ?? [])];

  const ofUser = ({ roomId, userId }: Member) =>
    inRoom(roomId).filter((socket) => socket.userId === userId);

  return {
    add: (socket: Socket) => {
      const room = rooms.get(socket.roomId) ?? new Map<string, Socket>();
      rooms.set(socket.roomId, room.set(socket.id, socket));
    },

    // True when the removed socket was the user's last one in the room.
    remove: (roomId: string, id: string) => {
      const socket = rooms.get(roomId)?.get(id);
      if (!socket) return false;
      rooms.get(roomId)?.delete(id);
      return ofUser(socket).length === 0;
    },

    get: (roomId: string, id: string) => rooms.get(roomId)?.get(id),

    // The user ids with an open socket in the room.
    connected: (roomId: string) =>
      new Set(inRoom(roomId).map((socket) => socket.userId)),

    // Sends each user their own message, if they have one.
    sendEach: (roomId: string, messages: Map<string, RoomMessage>) => {
      for (const socket of inRoom(roomId)) {
        const message = messages.get(socket.userId);
        if (message) socket.send(message);
      }
    },

    sendTo: (member: Member, message: RoomMessage) => {
      for (const socket of ofUser(member)) socket.send(message);
    },

    close: (member: Member) => {
      for (const socket of ofUser(member)) socket.close();
    },
  };
};

export type Sockets = ReturnType<typeof createSockets>;
