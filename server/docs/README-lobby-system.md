# Lobby System (Planned)

This document tracks the planned multi-game lobby system and current implementation status.

## Goals

- [ ] Server startup should not auto-create a game.
- [ ] Connected users should land on a global lobby screen.
- [ ] Lobby should list only joinable games (pre-match configuration state).
- [ ] Each lobby game should be independently scoped for runtime state and logging.
- [ ] Each game should support owner moderation actions (kick/ban) before match start.

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
- [ ] Phase 2: server lobby directory and multi-game runtime scoping
- [ ] Phase 3: join/leave/reconnect/kick/ban flow implementation
- [ ] Phase 4: frontend lobby UI and routing integration

## Implementation Plan Location

Detailed task checklist is tracked in:

- `server/TMP_LOBBY_SYSTEM_CHECKLIST.md`

This file is temporary and can be renamed/moved once implementation stabilizes.
