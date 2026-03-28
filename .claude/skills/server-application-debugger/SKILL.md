---
name: server-application-debugger
description: Debug a running game server by inspecting and mutating live debug endpoints, OpenAPI, and runtime log files. Use when prompts mention running-game investigation, such as "In a running game degug why", "i have a game running and", or requests to diagnose behavior using provided game and match IDs.
---

# Server Application Debugger

## Overview

Debug live game behavior through `/debug/*` endpoints and server log files.
Use the running OpenAPI document to discover exactly what can be read or changed.

## Workflow

1. Resolve target server URL.
- Prefer user-provided host/port.
- If `server/.env` exists and defines `PORT`, use that port before defaulting.
- Default to `http://localhost:3001`.
- If needed, try known LAN host `http://192.168.0.149:3001`.

2. Confirm debug API availability.
- Request `GET /debug/openapi.json`.
- If `403`, check debug flags in `server/.env`:
  - `MATCH_STATE_EXPORT_ENABLED=true`
  - `MATCH_STATE_MERGE_ENABLED=true` when mutation is required.

3. Use provided identifiers aggressively.
- If user supplies `gameId` and `matchScopeId`, query match-scoped endpoints first.
- Build a minimal snapshot before changes (games, match summary, state export).

4. Use live OpenAPI as source of truth for allowed operations.
- Read `GET /debug/openapi.json` first for current paths/methods/params.
- Use repo spec `server/src/core/debug-openapi-spec.ts` as fallback when server is unavailable.
- If endpoints do not exist for debugging the current issue, suggest
  creating them.

5. Mutate state only when explicitly requested.
- Use `PATCH /debug/games/{gameId}/matches/{matchScopeId}/state`.
- Capture before/after state and explain exact diffs.

6. Correlate with file logs.
- Determine if file logging is enabled from `server/.env` (`LOG_TO_FILE=true`).
- Read server/game/match logs from `server/game-data/**`.

## Required Inputs

- `gameId` when debugging a specific game.
- `matchScopeId` when debugging a specific match scope.
- Optional explicit server base URL if not localhost.

## References

- Use `references/live-debug-playbook.md` for concrete commands and file paths.
