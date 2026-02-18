# Lobby System (Planned)

This document tracks the planned multi-game lobby system and current implementation status.

## Goals

- [x] Server startup should not auto-create a game.
- [ ] Connected users should land on a global lobby screen.
- [x] Lobby should list only joinable games (pre-match configuration state).
- [x] Each lobby game should be independently scoped for runtime state and logging.
- [x] Each game should support owner moderation actions (kick/ban) before match start.

## Confirmed Decisions

- [x] Ban identity uses `sessionId` for now.
- [x] A future migration to stronger identity is required (tracked in `server/todo.md`).
- [x] `gameId` is stable for the life of a lobby game.
- [x] `matchId` changes when a new match starts/restarts inside the same `gameId`.
- [x] If no human players remain in a game during configuration, that game is removed.
- [x] Join-capacity races should reject late joiners with an explicit error and keep them in lobby.

## Runtime Model

Current direction is **single server process, multiple in-runtime game instances**:

- [x] Root runtime owns a global lobby directory.
- [x] Each lobby game has isolated game-level state/services.
- [x] Each started match inside a game has isolated match-level scope.

This preserves deterministic behavior while avoiding cross-process coordination complexity.

## Socket Contract Status

Phase 1 contract work is complete in shared types:

- [x] Added lobby domain types:
  `LobbyGameStatus`, `LobbyGameSummary`, `LobbyJoinRejectedReason`, `LobbyJoinRejectedPayload`
- [x] Added server->client events:
  `lobbySnapshot`, `lobbyGameUpdated`, `lobbyGameRemoved`, `joinLobbyRejected`, `kickedFromGame`, `bannedFromGame`
- [x] Added client->server events:
  `requestLobbySnapshot`, `createLobbyGame`, `joinLobbyGame`, `leaveLobbyGame`, `kickLobbyPlayer`, `banLobbyPlayer`, `unbanLobbyPlayer`

## Phase Progress

- [x] Phase 1: shared contracts and documentation baseline
- [x] Phase 2: server lobby directory and multi-game runtime scoping
- [x] Phase 3: join/leave/reconnect/kick/ban flow implementation
- [ ] Phase 4: frontend lobby UI and routing integration

## Phase 2 Completion Notes

- [x] Added root `LobbyDirectoryService` to manage global lobby state and multi-game routing.
- [x] Added `GameScopeFactory` for per-game DI scoping and isolation.
- [x] Switched server transport startup/shutdown/debug wiring from singleton `Game` to lobby directory orchestration.
- [x] Updated game/match runtime traffic to use per-game socket rooms (`game:{gameId}`).
- [x] Added automatic removal of config-state games when no connected human players remain.

## Phase 3 Completion Notes

- [x] Added `joinLobbyGame` validation for missing games, full games, in-match games, and banned sessions.
- [x] Added explicit `joinLobbyRejected` reasons/messages and ensured rejected sessions remain in lobby context.
- [x] Added `leaveLobbyGame` flow to remove lobby players and return them to global lobby view.
- [x] Added owner-only `kickLobbyPlayer` flow with immediate target redirect/message to lobby.
- [x] Added owner-only `banLobbyPlayer`/`unbanLobbyPlayer` flow keyed by `sessionId`.
- [x] Preserved reconnect routing so sessions are automatically re-attached to their existing game context.
