import { m } from '#lib/paraglide/messages.js';

// The username of the player with this id, from room members or match players.
export const usernameIn = (
  players: { id: string; username: string | null }[],
  id: string,
) => players.find((player) => player.id === id)?.username ?? m.former_player();
