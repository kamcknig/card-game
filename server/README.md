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

### Storage Backend Variables

A single `STORAGE_BACKEND` env var selects the persistence layer for **both** auth (sessions, users) and game data (match-configuration saves). When the value is missing or unrecognized the process still starts so `/status` can surface the misconfiguration to the frontend (see _Health endpoint_ below) — the server intentionally does not crash on storage misconfiguration so operators can diagnose it through the UI rather than the container logs.

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_BACKEND` | _(required for normal operation)_ | Selects the storage backend. Allowed values: `in-memory` (no persistence, dev/test only) or `supabase`. Unset/invalid values produce a `STORAGE_BACKEND_INVALID` health issue and the in-memory fallback stores are used (no persistence) |
| `SUPABASE_URL` | _(required for `supabase`)_ | Supabase project URL. Required when `STORAGE_BACKEND=supabase` |
| `SUPABASE_SERVICE_ROLE_KEY` | _(required for `supabase`)_ | Supabase service-role key. Server-side only — bypasses RLS. NEVER commit to git or expose to a browser |

**Health endpoint.** Regardless of backend, the server exposes `GET /status` which returns a JSON snapshot of the current health state (overall `status`, list of `issues`, active `backend`, `startedAt` timestamp). The HTTP status is always 200 — severity is conveyed in the body so monitoring probes can branch on the JSON. The Angular frontend gates the app on this endpoint at boot and redirects to `/server-status` when the snapshot reports `error`.

Issue codes the storage layer can register:

| Code | Level | Cause |
|------|-------|-------|
| `STORAGE_BACKEND_INVALID` | error | `STORAGE_BACKEND` env var is unset or not one of `in-memory`/`supabase` |
| `SUPABASE_CONFIG_MISSING` | error | `STORAGE_BACKEND=supabase` but `SUPABASE_URL` and/or `SUPABASE_SERVICE_ROLE_KEY` are unset |
| `SUPABASE_OPEN_FAILED` | error | Connection to Supabase or initial table reads failed at startup |

### Authentication Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_ALLOWED_ORIGINS` | `*` | Comma-separated origin allowlist for `/auth/*` CORS. Use `*` for any origin (dev only). Example: `http://localhost:51455,http://localhost:4200` |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | `10` | Max failed login attempts per IP per window before returning 429 |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `60000` | Sliding-window duration (ms) for the IP rate limiter |
| `AUTH_MAX_BODY_BYTES` | `4096` | Max request body size (bytes) on `/auth/login` and `/auth/register`. Requests exceeding this are rejected with 413 |
| `AUTH_SESSION_TTL_MS` | `604800000` | Session TTL (ms, sliding window). Each validated token has its expiry extended by this amount. Default: 7 days |
| `AUTH_LOCKOUT_THRESHOLD` | `5` | Consecutive failed logins before a user account is locked (per-account, independent of the IP rate limiter) |
| `AUTH_LOCKOUT_DURATION_MS` | `600000` | Lockout duration (ms) once the per-account threshold is exceeded. Default: 10 minutes |
| `AUTH_MIN_PASSWORD_LENGTH` | `10` | Minimum password length enforced at registration and password-change |

## Authentication Usage

New accounts are created via open email-based registration at
`POST /auth/register` — no invite code is required. When `STORAGE_BACKEND=supabase`,
Supabase Auth is the identity authority: registration provisions a Supabase Auth
user and sends a confirmation email; login is resolved via
`supabase.auth.signInWithPassword` after the server looks up the email for the
supplied username. When `STORAGE_BACKEND=in-memory`, argon2id handles password
verification locally, no email is sent, and all data is lost when the process
exits.

**Legacy users** (rows with `email = null`, predating this feature) continue to
log in using the local argon2id fallback. On their next login the server includes
`needsEmail: true` in the response and the UI guides them to `/profile/security`
to attach an email. Once an email is attached, subsequent logins go through
Supabase Auth. There is no batch migration script — the transition happens
automatically per user at login.

### HTTP endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/auth/login` | public | Exchange username + password for a session token. Response includes `needsEmail: boolean` |
| `POST` | `/auth/register` | public (rate-limited) | Create an account. Body: `{ username, email, password }` |
| `POST` | `/auth/email` | bearer | Attach an email to a legacy account. Body: `{ email, password }` |
| `POST` | `/auth/change-password` | bearer | Rotate the caller's password |
| `GET` | `/auth/validate` | bearer | Validate an existing token and refresh user state. Returns 401 and invalidates the session if: the local user record no longer exists, the account's `disabled` flag is set, or (supabase backend) the Supabase Auth user has been deleted or banned. Response includes `needsEmail: boolean` |
| `DELETE` | `/auth/logout` | bearer | Invalidate the caller's token |
| `GET` | `/auth/sessions` | bearer | List the caller's active sessions |
| `DELETE` | `/auth/sessions[?keepCurrent=true]` | bearer | Revoke the caller's sessions |
| `GET` | `/auth/check-username?username=<value>` | public | Report whether a username is already taken |
| `GET` | `/auth/check-email?email=<value>` | public | Report whether an email is already registered |

### Bootstrap workflow

Before any users exist, `/auth/login` rejects every request, so the very first
account must be provisioned directly against the configured backend. The CLI
script honours `STORAGE_BACKEND` and targets the appropriate backend.

When `STORAGE_BACKEND=supabase`, the script talks to the Supabase project via the
service-role key and may run while the server is up — DB writes are visible to
the running server on its next read. When `STORAGE_BACKEND=in-memory`, all state
lives only in the running process and cannot be bootstrapped via CLI before
startup; use open registration at `POST /auth/register` to create the first
account once the server is running.

```bash
# 1. Create the first user directly in the store (supabase backend).
deno task auth:users create --username <name> --password <pw>

# 2. Log in to mint a session token.
curl -sSX POST http://localhost:3001/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"<name>","password":"<pw>"}'
```

Additional accounts are created by registering through the UI or `POST /auth/register`
directly — no registration code is needed.

### CLI scripts

The user management script uses the backend selected by `STORAGE_BACKEND`. When
that value is `supabase`, the script talks to the Supabase project via the
service-role key and may run while the server is up. The `in-memory` backend
does not support CLI user management — all state is transient. Intended for
bootstrapping and operator maintenance only.

```bash
# User management: create | delete | set-password | set-email | list | clear
# Run a subcommand with --help for its options.
deno task auth:users <command> [options]
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
