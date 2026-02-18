# Lobby System Implementation Checklist (Temporary)

## Confirmed Decisions
- Use `sessionId` as the temporary identity key for bans.
- Add a follow-up TODO in `server/todo.md` to replace `sessionId` with a stronger long-term identity model.
- Keep owner reassignment behavior (if owner leaves/disconnects, assign a replacement human where possible) in the new per-game model.
- If no human players remain during **match configuration**, remove that game automatically.
- If a user is rejected during join because the game filled first, show an error and keep/return them to lobby view.
- A `gameId` remains stable for the lifetime of the lobby game.
- A `matchId` changes for each started/restarted match inside the same `gameId`.

## Phase 1: Shared Contracts and Types
- [ ] Add lobby-domain shared types for game list and status (`configuring`, `inMatch`, `closed`).
- [ ] Add shared socket events for lobby list/snapshot updates, join/leave, kick/ban, and join rejection reasons.
- [ ] Add structured join rejection payload (at least: reason code, user-facing message, gameId).
- [ ] Add explicit payload shape for lobby game summaries (id, name, player counts, joinable state).

## Phase 2: Server Lobby Directory and Game Scoping
- [ ] Introduce a root `LobbyDirectoryService` to own all active lobby games.
- [ ] Stop creating a game at server startup; only initialize lobby directory and expansion data.
- [ ] Add `GameScopeFactory` so each lobby game has isolated runtime state/services.
- [ ] Keep per-game owner/session/player state isolated from other games.
- [ ] Generate new games with random names (`adjective + animal`) from server-owned lists.
- [ ] Add deterministic collision handling if a generated name already exists.
- [ ] Enforce max players (`6`) atomically at join time.

## Phase 3: Join/Leave/Reconnect/Kick/Ban Flows
- [ ] Implement `joinLobbyGame` with checks: game exists, status is joinable, not full, not banned.
- [ ] Ensure join-capacity races are handled atomically so only one final-slot join succeeds.
- [ ] Emit `joinLobbyRejected` with reason/message for failed joins and keep client in lobby scene.
- [ ] Implement `leaveLobbyGame` from match configuration to return player to lobby scene.
- [ ] Implement owner-only `kickLobbyPlayer` and return kicked user to lobby scene.
- [ ] Implement owner-only `banLobbyPlayer` keyed by `sessionId` and force target back to lobby.
- [ ] Reject banned users on future joins with explicit error message.
- [ ] Preserve reconnect semantics per game; reconnect should route user to their correct game context.

## Phase 4: Game/Match Lifecycle Rules
- [ ] When a game starts a match, remove it from lobby joinable list immediately.
- [ ] Keep game alive across match restarts with same `gameId` and new `matchId`.
- [ ] Remove a game automatically when no human players remain in configuration state.
- [ ] Define and implement behavior when last human leaves during an active match (align with existing policy flags).
- [ ] Ensure owner reassignment logic runs per game instance, not globally.

## Phase 5: Frontend Lobby Screen (Angular)
- [ ] Add a dedicated lobby scene as the default post-connect screen.
- [ ] Build layout: top header (`Dominion Clone`), left vertical nav, right content panel.
- [ ] Add single nav item (`Games`) that is selected by default on connect.
- [ ] Render live list of joinable games with: join button, name, `playerCount/6`.
- [ ] Disable join button when game is full.
- [ ] Add create-game action in lobby UI so users can create initial game(s).
- [ ] On successful join, transition to current match configuration view for that game.
- [ ] Add `Leave Game` control to match configuration view.
- [ ] Add owner controls to kick/ban players in match configuration view.
- [ ] On leave/kick/ban, route affected player back to lobby scene and show message when relevant.

## Phase 6: Logging and Operational Isolation
- [ ] Add `gameId` and `matchId` into logger context for all game/match scoped logs.
- [ ] Separate logs by game/match path:
- [ ] `server/logs/games/{gameId}/lobby.log`
- [ ] `server/logs/games/{gameId}/matches/{matchId}/server.log`
- [ ] Ensure each new match restart creates a new `matchId` log directory.
- [ ] Ensure disposal/cleanup of scoped services closes handlers cleanly and avoids cross-game leakage.

## Phase 7: Persistence and Recovery (Initial)
- [ ] Decide whether lobby game list itself is persisted across server restarts (initially likely no).
- [ ] Keep existing persisted match configuration behavior scoped to intended game(s) policy.
- [ ] Confirm banned-session storage strategy (memory-only initially vs persisted) and implement explicitly.

## Phase 8: Documentation and Follow-ups
- [ ] Update architecture docs with new root lobby directory + per-game/per-match scope model.
- [ ] Document socket event contracts for lobby operations.
- [ ] Add TODO in `server/todo.md`:
- [ ] `Replace sessionId-based ban identity with durable account/auth identity and migration path.`

