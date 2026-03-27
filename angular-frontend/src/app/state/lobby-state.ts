import { atom } from 'nanostores';
import { LobbyGameSummary, LobbyJoinRejectedPayload } from 'shared/types';

const ACTIVE_GAME_KEY = 'activeLobbyGameId';
const initialActiveGameId = localStorage.getItem(ACTIVE_GAME_KEY) ?? undefined;

// Stores the current global lobby game summaries rendered by the lobby UI.
export const lobbyGamesStore = atom<LobbyGameSummary[]>([]);
// Stores the currently active game id for this client session.
export const activeLobbyGameIdStore = atom<string | undefined>(initialActiveGameId);
// Stores transient user-facing lobby status messages (errors, kick/ban notices).
export const lobbyStatusMessageStore = atom<string | undefined>();
// Stores the latest structured join rejection payload for diagnostics/UI display.
export const lobbyJoinRejectedStore = atom<LobbyJoinRejectedPayload | undefined>();

// Persist active game id so reconnects can restore intended lobby context.
activeLobbyGameIdStore.subscribe((gameId) => {
  if (gameId) {
    localStorage.setItem(ACTIVE_GAME_KEY, gameId);
    return;
  }
  localStorage.removeItem(ACTIVE_GAME_KEY);
});

(globalThis as any).lobbyGamesStore = lobbyGamesStore;
(globalThis as any).activeLobbyGameIdStore = activeLobbyGameIdStore;
(globalThis as any).lobbyStatusMessageStore = lobbyStatusMessageStore;
(globalThis as any).lobbyJoinRejectedStore = lobbyJoinRejectedStore;
