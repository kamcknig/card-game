# Live Debug Playbook

## Resolve Host/Port

- Prefer user-provided server URL.
- Otherwise read `server/.env` when present and use `PORT` if set.
- Fallback default: `http://localhost:3001`.
- Optional LAN fallback: `http://192.168.0.149:3001`.

Example:

```bash
PORT_FROM_ENV="$(rg -n '^PORT=' server/.env -N --no-line-number | cut -d'=' -f2 | tr -d '\r' || true)"
PORT="${PORT_FROM_ENV:-3001}"
BASE_URL="http://localhost:${PORT}"
```

## Confirm Debug API

```bash
curl -i "$BASE_URL/debug/openapi.json"
```

If disabled (`403`), check:

```bash
rg -n "^(MATCH_STATE_EXPORT_ENABLED|MATCH_STATE_MERGE_ENABLED|LOG_TO_FILE|LOG_FILE_MAX_BYTES|PORT)=" server/.env server/.env-example
```

## Live Debug Requests

```bash
curl -fsS "$BASE_URL/debug/openapi.json" | jq -r '.paths | keys[]'
curl -fsS "$BASE_URL/debug/games" | jq
curl -fsS "$BASE_URL/debug/games/$GAME_ID/matches" | jq
curl -fsS "$BASE_URL/debug/games/$GAME_ID/matches/$MATCH_SCOPE_ID/state" | jq
```

Patch match state only when explicitly requested:

```bash
curl -fsS -X PATCH "$BASE_URL/debug/games/$GAME_ID/matches/$MATCH_SCOPE_ID/state" \
  -H "content-type: application/json" \
  --data '{"turn":{"actions":99}}' | jq
```

## Log Files

With typical startup from `server/`, logs are under `server/game-data`.

- Server logs: `server/game-data/logs/server`
- Game logs: `server/game-data/games/<safeGameId>/logs`
- Match logs: `server/game-data/games/<safeGameId>/matches/match-####/logs`

`safeGameId` uses this sanitization:

```bash
SAFE_GAME_ID="$(printf '%s' "$GAME_ID" | sed -E 's/[^A-Za-z0-9_-]/_/g')"
MATCH_LABEL="$(printf 'match-%04d' "$MATCH_SCOPE_ID")"
```

Inspect logs:

```bash
rg -n "error|warn|debug|$GAME_ID|$MATCH_SCOPE_ID" server/game-data -g "*.log"
tail -n 200 "server/game-data/logs/server/$(date +%Y%m%d).log"
```
