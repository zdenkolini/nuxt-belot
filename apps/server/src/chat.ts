import type { Member } from './session';

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

type Recipient = { userId: string; send: (message: ChatServerMessage) => void };

const maxLength = 500;
const historyLength = 100;

// Chat lives in memory, by room. Mutes are per player and per room, and only
// filter what the muting player receives.
export const createChat = () => {
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

  // Handles a chat intent from a member's socket; `recipients` are the open
  // sockets of everyone in the room.
  const handle = (
    socket: Member & Recipient,
    intent: ChatIntent,
    recipients: Recipient[],
  ) => {
    const { roomId, userId: from } = socket;
    if (intent.type === 'chat.history')
      return socket.send(history(roomId, from));
    if (intent.type === 'chat.send') {
      const text = String(intent.text).trim();
      if (!text || text.length > maxLength) return;
      const message = { id: crypto.randomUUID(), from, text, at: Date.now() };
      const log = logs.get(roomId) ?? [];
      logs.set(roomId, [...log, message].slice(-historyLength));
      for (const r of recipients) {
        if (!mutedBy(roomId, r.userId).has(from)) {
          r.send({ type: 'chat.message', message });
        }
      }
      return;
    }
    const muted = mutedBy(roomId, from);
    if (intent.type === 'chat.mute') muted.add(intent.userId);
    else if (intent.type === 'chat.unmute') muted.delete(intent.userId);
    else return;
    for (const r of recipients) {
      if (r.userId === from) r.send(history(roomId, from));
    }
  };

  // Drops a room's chat once the room is gone.
  const forget = (roomId: string) => {
    logs.delete(roomId);
    mutes.delete(roomId);
  };

  return { handle, forget };
};
