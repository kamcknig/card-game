# Lobby System (Planned)

This document tracks the planned multi-game lobby system and current implementation status.

## Goals

- Server startup should not auto-create a game.
- Connected users should land on a global lobby screen.
- Lobby should list only joinable games (pre-match configuration state).
- Each lobby game should be independently scoped for runtime state and logging.
- Each game should support owner moderation actions (kick/ban) before match start.

## Confirmed Decisions

- Ban identity uses `sessionId` for now.
- A future migration to stronger identity is required (tracked in `server/todo.md`).
- `gameId` is stable for the life of a lobby game.
- `matchId` changes when a new match starts/restarts inside the same `gameId`.
- If no human players remain in a game during configuration, that game is removed.
- Join-capacity races should reject late joiners with an explicit error and keep them in lobby.

## Runtime Model

Current direction is **single server process, multiple in-runtime game instances**:

- Root runtime owns a global lobby directory.
- Each lobby game has isolated game-level state/services.
- Each started match inside a game has isolated match-level scope.

This preserves deterministic behavior while avoiding cross-process coordination complexity.

## Socket Contract Status

Phase 1 contract work is complete in shared types:

- Added lobby domain types:
  - `LobbyGameStatus`
  - `LobbyGameSummary`
  - `LobbyJoinRejectedReason`
  - `LobbyJoinRejectedPayload`
- Added server->client events:
  - `lobbySnapshot`
  - `lobbyGameUpdated`
  - `lobbyGameRemoved`
  - `joinLobbyRejected`
  - `kickedFromGame`
  - `bannedFromGame`
- Added client->server events:
  - `requestLobbySnapshot`
  - `createLobbyGame`
  - `joinLobbyGame`
  - `leaveLobbyGame`
  - `kickLobbyPlayer`
  - `banLobbyPlayer`
  - `unbanLobbyPlayer`

## Implementation Plan Location

Detailed task checklist is tracked in:

- `server/TMP_LOBBY_SYSTEM_CHECKLIST.md`

This file is temporary and can be renamed/moved once implementation stabilizes.
