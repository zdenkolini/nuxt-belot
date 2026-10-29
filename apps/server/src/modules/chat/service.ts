import type { Socket, Sockets } from '#src/modules/sockets/service';

export type ChatMessage = {
  id: string;
  from: string;
  text: string;
  at: number;
};

// What the server sends about chat over the room socket. `chat.history` is
// the room's recent chat as one player sees it, without muted players.
export type ChatServerMessage =
  | { type: 'chat.message'; message: ChatMessage }
  | { type: 'chat.history'; messages: ChatMessage[]; muted: string[] };

// What a player sends about chat over the room socket.
export type ChatIntent =
  | { type: 'chat.send'; text: string }
  | { type: 'chat.mute'; userId: string }
  | { type: 'chat.unmute'; userId: string }
  | { type: 'chat.history' };

export const isChatIntent = (
  intent: { type?: unknown; text?: unknown; userId?: unknown } | null,
): intent is ChatIntent => {
  switch (intent?.type) {
    case 'chat.history':
      return true;
    case 'chat.send':
      return typeof intent.text === 'string';
    case 'chat.mute':
    case 'chat.unmute':
      return typeof intent.userId === 'string';
  }
  return false;
};

const maxLength = 500;
const historyLength = 100;

export const chatText = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > maxLength) return undefined;
  return trimmed;
};

// Chat lives in memory, by room. Mutes are per player and per room, and only
// filter what the muting player receives.
export const createChat = (sockets: Sockets) => {
  const logs = new Map<string, ChatMessage[]>();
  const mutes = new Map<string, Map<string, Set<string>>>();

  const mutedBy = (roomId: string, userId: string) => {
    const room = mutes.get(roomId) ?? new Map<string, Set<string>>();
    mutes.set(roomId, room);
    const muted = room.get(userId) ?? new Set<string>();
    room.set(userId, muted);
    return muted;
  };

  const history = (roomId: string, userId: string): ChatServerMessage => {
    const muted = mutedBy(roomId, userId);
    return {
      type: 'chat.history',
      messages: (logs.get(roomId) ?? []).filter((m) => !muted.has(m.from)),
      muted: [...muted],
    };
  };

  const post = (socket: Socket, text: string) => {
    const { roomId, userId: from } = socket;
    const clean = chatText(text);
    if (!clean) return;
    const message = {
      id: crypto.randomUUID(),
      from,
      text: clean,
      at: Date.now(),
    };
    const log = logs.get(roomId) ?? [];
    logs.set(roomId, [...log, message].slice(-historyLength));
    const hearing = [...sockets.connected(roomId)].filter(
      (id) => !mutedBy(roomId, id).has(from),
    );
    const sent: ChatServerMessage = { type: 'chat.message', message };
    sockets.sendEach(roomId, new Map(hearing.map((id) => [id, sent])));
  };

  const handle = (socket: Socket, intent: ChatIntent) => {
    const { roomId, userId } = socket;
    switch (intent.type) {
      case 'chat.history':
        return socket.send(history(roomId, userId));
      case 'chat.send':
        return post(socket, intent.text);
      case 'chat.mute':
        mutedBy(roomId, userId).add(intent.userId);
        return sockets.sendTo(socket, history(roomId, userId));
      case 'chat.unmute':
        mutedBy(roomId, userId).delete(intent.userId);
        return sockets.sendTo(socket, history(roomId, userId));
    }
  };

  // Drops a room's chat once the room is gone.
  const forget = (roomId: string) => {
    logs.delete(roomId);
    mutes.delete(roomId);
  };

  return { handle, forget };
};
