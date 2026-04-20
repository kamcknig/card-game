import { atom } from 'nanostores';
import { LobbyGameSummary, LobbyJoinRejectedPayload } from 'shared/types';

// Stores the current global lobby game summaries rendered by the lobby UI.
export const lobbyGamesStore = atom<LobbyGameSummary[]>([]);
// Stores the currently active game id for this client session.
// Not persisted to localStorage: the server re-emits 'joinedLobbyGame' with
// the current gameId on every reconnect, and its sessionToGameId map is the
// authoritative source. Persisting across refreshes created stale values that
// mis-gated match-scoped UI state after the server had ended/removed a game.
export const activeLobbyGameIdStore = atom<string | undefined>();
// Stores transient user-facing lobby status messages (errors, kick/ban notices).
export const lobbyStatusMessageStore = atom<string | undefined>();
// Stores the latest structured join rejection payload for diagnostics/UI display.
export const lobbyJoinRejectedStore = atom<LobbyJoinRejectedPayload | undefined>();

(globalThis as any).lobbyGamesStore = lobbyGamesStore;
(globalThis as any).activeLobbyGameIdStore = activeLobbyGameIdStore;
(globalThis as any).lobbyStatusMessageStore = lobbyStatusMessageStore;
(globalThis as any).lobbyJoinRejectedStore = lobbyJoinRejectedStore;
