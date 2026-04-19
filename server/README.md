# Game Server

Deno TypeScript game server providing Socket.IO-based multiplayer for the Dominion card game.

## Prerequisites

- [Deno](https://deno.land/) (v2+)

## Running Locally

```bash
# install dependencies
npm install

# start with file watch (default port 3001)
deno task dev:watch
```

The server reads an `.env` file automatically when using `deno task dev:watch`. Copy the example to get started:

```bash
cp .env-example .env
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the server listens on |
| `LOG_TO_FILE` | `false` | Enable file-based logging |
| `LOG_FILE_MAX_BYTES` | `5242880` (5 MB) | Max log file size before rotation |
| `LOG_COLOR` | _(unset)_ | Enable colored console log output |
| `GAME_DATA_ROOT` | `./game-data` | Root directory for all persisted runtime data (logs, saved configs) |
| `MATCH_STATE_EXPORT_ENABLED` | `false` | Enable the `/debug/match-state` export endpoint |
| `MATCH_STATE_MERGE_ENABLED` | `false` | Enable the match state merge debug endpoint |
| `MATCH_STATE_PATH` | _(unset)_ | Optional path to a match state file to load on startup |
| `END_MATCH_ON_NO_HUMANS` | `true` | End active matches when all human players disconnect |
| `TOOLTIP_DEFAULT_CLOSE_DELAY_MS` | _(unset)_ | Default delay (ms) before closing tooltips, sent to clients |

### Authentication Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_ALLOWED_ORIGINS` | `*` | Comma-separated origin allowlist for `/auth/*` CORS. Use `*` for any origin (dev only). Example: `http://localhost:51455,http://localhost:4200` |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | `10` | Max failed login attempts per IP per window before returning 429 |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `60000` | Sliding-window duration (ms) for the IP rate limiter |
| `AUTH_MAX_BODY_BYTES` | `4096` | Max request body size (bytes) on `/auth/login` and `/auth/register`. Requests exceeding this are rejected with 413 |
| `AUTH_SESSION_TTL_MS` | `604800000` | Session TTL (ms, sliding window). Each validated token has its expiry extended by this amount. Default: 7 days |
| `AUTH_SESSION_STORE` | `memory` | Session storage backend. `memory` loses sessions on restart. `kv` uses Deno KV with a write-through cache (see `AUTH_KV_PATH`) |
| `AUTH_KV_PATH` | `./game-data/auth.kv` | Filesystem path to the Deno KV store (used when `AUTH_SESSION_STORE=kv`). Use `':memory:'` for dev/tests |
| `AUTH_LOCKOUT_THRESHOLD` | `5` | Consecutive failed logins before a user account is locked (per-account, independent of the IP rate limiter) |
| `AUTH_LOCKOUT_DURATION_MS` | `600000` | Lockout duration (ms) once the per-account threshold is exceeded. Default: 10 minutes |
| `AUTH_MIN_PASSWORD_LENGTH` | `10` | Minimum password length enforced at registration and password-change |

## Authentication Usage

Accounts are created via HTTP registration (`POST /auth/register`) using a
registration code. Registration codes are issued by any authenticated user via
HTTP (`POST /auth/registration-codes`) or by CLI scripts for bootstrapping.

### HTTP endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/auth/login` | public | Exchange username + password for a session token |
| `POST` | `/auth/register` | public (rate-limited) | Create an account using a valid registration code |
| `POST` | `/auth/change-password` | bearer | Rotate the caller's password |
| `GET` | `/auth/validate` | bearer | Validate an existing token |
| `DELETE` | `/auth/logout` | bearer | Invalidate the caller's token |
| `GET` | `/auth/sessions` | bearer | List the caller's active sessions |
| `DELETE` | `/auth/sessions[?keepCurrent=true]` | bearer | Revoke the caller's sessions |
| `POST` | `/auth/registration-codes` | bearer | Create a new registration code |
| `GET` | `/auth/registration-codes` | bearer | List active registration codes |
| `DELETE` | `/auth/registration-codes/:code` | bearer | Disable a registration code |
| `GET` | `/auth/check-username?username=<value>` | public | Report whether a username is already taken |

### Bootstrap workflow

Before any users exist, both `/auth/login` and `/auth/registration-codes`
reject every request, so the very first account must be provisioned directly
against the Deno KV file. Because the running server keeps an in-memory cache
of the KV state primed at startup, **CLI writes while the server is running
are invisible to the running process and risk SQLite lock contention on the
shared `auth.kv` file**. Stop the server before running the CLI scripts below,
then restart.

```bash
# 1. Stop the server (so the CLI and server do not both hold auth.kv).
# 2. Create the first user directly in the KV store.
deno task auth:users create --username <name> --password <pw> [--kv <path>]

# 3. Restart the server.

# 4. Log in to mint a session token.
curl -sSX POST http://localhost:3001/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"<name>","password":"<pw>"}'

# 5. Use the returned token to issue registration codes for everyone else.
curl -sSX POST http://localhost:3001/auth/registration-codes \
  -H "authorization: Bearer <token>" \
  -H 'content-type: application/json' \
  -d '{"maxUses":1,"expiresIn":3600000}'
```

Once at least one account exists, prefer the HTTP endpoints for day-to-day
user and code management — they go through the same in-memory store the
registration handler reads from, so new codes are visible immediately.

### CLI scripts

Both scripts write to the Deno KV store directly and **must be run with the
server stopped** to avoid stale caches and SQLite lock contention. Intended
for bootstrapping and operator maintenance only.

```bash
# User management: create | delete | set-password | clear
# Run a subcommand with --help for its options.
deno task auth:users <command> [options]

# Create a registration code (accepts --expires-in, --max-uses, --created-by, --kv).
deno task auth:create-reg-code [--expires-in <duration>] [--max-uses N] [--created-by <user>] [--kv <path>]
# Duration strings: 30s, 10m, 24h, 7d
```

## Other Commands

```bash
# type check
deno check --no-lock src/server.ts

# lint
deno lint src/

# format (uses oxfmt)
deno task fmt

# unit tests
deno task test:unit
```

## Docker

Build and run from the repository root:

```bash
# build
docker build -f docker/DockerFile_server -t dominion-server .

# run (default PORT=3000 inside the container)
docker run -d -p 3000:3000 dominion-server

# run with custom configuration
docker run -d -p 4000:4000 \
  -e PORT=4000 \
  -e LOG_TO_FILE=true \
  -e MATCH_STATE_EXPORT_ENABLED=true \
  dominion-server
```

The container uses `denoland/deno:2.7.7` as its base image and pre-installs dependencies at build time.

### Persisting Data

Game data (logs, saved configurations) is written to `./game-data` inside the container by default. Mount a volume to persist it:

```bash
docker run -d -p 3000:3000 \
  -v $(pwd)/game-data:/app/server/game-data \
  dominion-server
```
