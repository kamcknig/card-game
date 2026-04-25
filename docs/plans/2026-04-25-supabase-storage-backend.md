# Unified `STORAGE_BACKEND`: Add Supabase, Deprecate Old Vars, Add Server Status Endpoint

## Context

Today the server has split-brained storage configuration: auth state (sessions, users, registration codes) is selected via `AUTH_SESSION_STORE` (`memory|kv`) and game data (match-configuration saves) is selected separately via `GAME_DATA_STORE` (`file|kv`). The user wants:

1. **One env var** — `STORAGE_BACKEND` — that drives **all** persistence. Allowed values: `kv` and `supabase`. (Memory-only mode is intentionally not supported on this knob; the in-memory classes remain available for tests but aren't selectable via the new var.)
2. **Supabase as a real backend** — auth tables and a match-configuration table live in the user's Supabase project; the server reads/writes them via supabase-js using the service-role key.
3. **Deprecation of the old vars** — `AUTH_SESSION_STORE`, `AUTH_KV_PATH`, `GAME_DATA_STORE`, `GAME_DATA_KV_PATH` keep working as a fallback when `STORAGE_BACKEND` is unset, but emit warnings; when both are set, `STORAGE_BACKEND` wins and the server logs a warning.
4. **A `/status` endpoint** that reports server health and configuration issues — the frontend gates app access on it.
5. **A frontend status route** that displays error-level issues and blocks the app; warnings only log to the console.
6. **A migration script** that lifts the existing Deno KV rows into Supabase.

The intended outcome: a single, clear backend switch with first-class Supabase support; deprecation that nudges operators forward without breaking existing deployments; and a health-aware UI that fails loudly on misconfiguration instead of silently breaking.

## Approach

### 1. New env var resolution

Add `getStorageBackend(): 'kv' | 'supabase'` and a separate `resolveStorageConfig()` to `ServerConfigService` that returns:

```ts
{
  backend: 'kv' | 'supabase',
  source: 'storage-backend' | 'legacy' | 'default',
  issues: ConfigIssue[],   // see status section
}
```

Resolution order:
1. `STORAGE_BACKEND` set to `kv` or `supabase` → use it. If any deprecated var is also set, append a warning issue.
2. `STORAGE_BACKEND` unset, deprecated vars set (`AUTH_SESSION_STORE=kv` / `GAME_DATA_STORE=kv`) → derive backend from them; append a deprecation warning issue. Mismatch (e.g., one is `kv` and the other is `memory`/`file`) → error issue and the server refuses to map to a single backend.
3. `STORAGE_BACKEND` unset, deprecated vars unset → fall through to historical defaults (`AUTH_SESSION_STORE=memory`, `GAME_DATA_STORE=file`) and append a warning issue ("no STORAGE_BACKEND set; using ephemeral defaults"). In this fallthrough only, the InMemory* and file-based stores stay reachable so dev workflows don't break.
4. `STORAGE_BACKEND=supabase` but `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` missing → error issue; server still starts but `/status` reports `error`.
5. `STORAGE_BACKEND=<anything else>` → error issue + server refuses to start (existing `validate()` throw behavior).

Add `getSupabaseUrl()` and `getSupabaseServiceRoleKey()` getters. `validate()` triggers `resolveStorageConfig()` so misconfiguration surfaces at startup.

### 2. Server status / health system

**New service `ServerHealthService`** (`server/src/core/server-health-service.ts`)
- Accumulates `Issue` records: `{ level: 'warning' | 'error', code: string, message: string }`.
- `register(issue)` called by `ServerStartupService` after config resolution and after each Supabase open attempt.
- `snapshot()` returns `{ status: 'healthy' | 'warning' | 'error', issues, backend, startedAt }` where `status` is the highest level present (no issues → healthy).

**New route handler `ServerStatusRouteHandlerService`** (`server/src/core/server-status-route-handler-service.ts`)
- Handles `GET /status` (and `OPTIONS /status` for CORS).
- Returns 200 with the snapshot JSON regardless of state — the body conveys severity, not the HTTP code, so the frontend always succeeds in fetching it.
- Wired into `ServerBootstrapService.start()` ahead of the auth/debug handlers.

Issue codes the plan introduces:
- `STORAGE_BACKEND_MISSING` (warning) — fallback to legacy or defaults.
- `STORAGE_BACKEND_LEGACY_USED` (warning) — derived from deprecated vars.
- `STORAGE_BACKEND_OVERRIDE` (warning) — both new and old set; new wins.
- `STORAGE_BACKEND_LEGACY_MISMATCH` (error) — old vars disagree.
- `SUPABASE_CONFIG_INVALID` (error) — URL/key missing.
- `SUPABASE_OPEN_FAILED` (error) — runtime connect/load failure during startup.

### 3. Supabase backend — runtime files

| File | Mirrors | Notes |
|---|---|---|
| `server/src/core/storage/supabase-client-provider.ts` | `auth/auth-kv-provider.ts` | Owns the single `SupabaseClient`. `open(url, key)` constructs once; `get()` returns it; no `close()` needed (supabase-js doesn't expose one). Errors thrown by `open()` are caught by `ServerStartupService` and reported as `SUPABASE_OPEN_FAILED`. |
| `server/src/core/auth/supabase-user-store.ts` | `deno-kv-user-store.ts` | Implements `UserStore`. `open(client)` selects all rows into the cache + `byId` index. `create()` issues an insert and awaits the returning row to learn the DB-assigned `id` (identity column). Other methods stay synchronous; writes fire `from('auth_users').upsert(...)` / `.delete()` async with `.catch(loggerService.warn)`. |
| `server/src/core/auth/supabase-session-store.ts` | `deno-kv-session-store.ts` | Implements `SessionStore`. `open()` loads non-expired rows; `purgeExpired()` issues `from('auth_sessions').delete().lte('expires_at', nowMs)` and prunes the cache. |
| `server/src/core/auth/supabase-registration-code-store.ts` | `deno-kv-registration-code-store.ts` | Implements `RegistrationCodeStore`. Same write-through pattern. |
| `server/src/core/supabase-match-configuration-save-service.ts` | `deno-kv-match-configuration-save-service.ts` | Implements `MatchConfigurationSaveStore`. Table key: `(username_lower, save_key)`; value column: `data JSONB`. `open()` loads all rows into the per-user cache. |

**Sync hot-path preserved.** The interfaces stay synchronous because the in-memory write-through cache remains the single source of truth at runtime; only `UserStore.create` becomes `Promise<UserRecord>` (it is already called from async route handlers and CLI scripts — verified at `server-auth-route-handler-service.ts:439` and `auth-user-mgmt.ts`). All other consumers stay sync.

**Cross-process consistency.** Like the existing Deno KV implementations, the Supabase stores assume one server process at a time owns the cache; multi-instance coordination is out of scope for this change (same caveat as today). Document in the file headers.

### 4. Schema — Supabase migration

`supabase/migrations/<timestamp>_create_storage_schema.sql`:

```sql
CREATE TABLE auth_users (
  id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL CHECK (password_algo IN ('argon2id','bcrypt')),
  password_updated_at BIGINT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until BIGINT,
  disabled BOOLEAN NOT NULL DEFAULT false,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at BIGINT NOT NULL
);

CREATE TABLE auth_sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  last_activity_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_from_ip TEXT,
  created_from_user_agent TEXT
);
CREATE INDEX idx_auth_sessions_username ON auth_sessions (username);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions (expires_at);

CREATE TABLE auth_registration_codes (
  code TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at BIGINT,
  max_uses INTEGER NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  disabled BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE match_configuration_saves (
  username_lower TEXT NOT NULL,
  save_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (username_lower, save_key)
);
CREATE INDEX idx_match_configuration_saves_username ON match_configuration_saves (username_lower);
```

Notes:
- `BIGINT` for timestamps to match the JS `Date.now()`-style numbers — no parsing.
- `INTEGER` (32-bit) for `auth_users.id` so it round-trips as a JS `number`.
- Tables intentionally do not enable RLS — all access goes through the service-role key from the server.

Apply via `supabase db push`.

### 5. Composition wiring

**`register-root-services.ts`** (lines 89-187)
- Replace the three `asFunction` factories' branching: read `serverConfigService.resolveStorageConfig()` once and select implementations off `backend`. Concretely, every factory now has `kv → DenoKv*`, `supabase → Supabase*`, and the legacy fallback (`memory` for auth, `file` for game data) only when the resolved source is `default` or `legacy` and the legacy var explicitly asked for memory/file.
- Register `supabaseClientProvider: asClass(SupabaseClientProvider).singleton()` near `authKvProvider`.
- Register `serverHealthService: asClass(ServerHealthService).singleton()`.
- Register `serverStatusRouteHandlerService: asClass(ServerStatusRouteHandlerService).singleton()`.

**`server-startup-service.ts`** (around lines 39-71)
- After `serverConfigService.validate()`, call `serverConfigService.resolveStorageConfig()` and push every issue into `serverHealthService`.
- Add a sibling branch alongside the KV branch: when any of the four stores is a `Supabase*` instance, call `await supabaseClientProvider.open(url, key)` once, then `await store.open(client)` for each Supabase store. Wrap in try/catch and on failure register a `SUPABASE_OPEN_FAILED` error and skip cache priming (the store falls back to an empty cache; `/status` will block the frontend).
- Inject `SupabaseClientProvider` and `ServerHealthService` into the constructor.

**`server-bootstrap-service.ts`** (start handler, lines 47-61)
- Insert `serverStatusRouteHandlerService.handleRequest(...)` ahead of auth/debug handlers so `/status` is always reachable, even when other systems are degraded.

### 6. Dependency

Add to `server/deno.json` `imports`:
```
"@supabase/supabase-js": "npm:@supabase/supabase-js@^2"
```

(`npm:` matches existing `npm:awilix`, `npm:lodash-es` style.)

### 7. CLI compatibility — `server/scripts/auth-user-mgmt.ts`

Refactor backend selection so it mirrors server resolution: read `STORAGE_BACKEND` (and fall back to `AUTH_SESSION_STORE` with a warning) and instantiate the appropriate `UserStore`. Same console-logger shim. Required so an operator using the CLI doesn't write to KV while the server reads from Supabase.

### 8. Migration script

`server/scripts/migrate-kv-to-supabase.ts` (renamed from auth-only since game data is also moving):
- Read env: `AUTH_KV_PATH`, `GAME_DATA_KV_PATH`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Open both KV files read-only and iterate the four prefixes (`auth_users`, `auth_sessions`, `auth_reg_codes`, and the match-config save key tuples).
- Use `client.from(table).upsert(rows, { onConflict: '<pk>' })` so re-runs are idempotent.
- For users, after import, advance the identity sequence past the max imported id (one statement; emitted as a final SQL line printed to stdout for the operator to run in Supabase Studio — keeps the script free of `pg_net`/`exec_sql` extension dependencies).
- Print per-table inserted counts; exit non-zero on any error.

Add task to `server/deno.json`: `"migrate-kv-to-supabase": "deno run --allow-env --allow-read --allow-net --unstable-kv scripts/migrate-kv-to-supabase.ts"`.

### 9. Frontend — `/status` gate

**Health service** `angular-frontend/src/app/core/server-status/server-status.service.ts`
- Holds a nanostore atom `serverStatus$` with the latest snapshot.
- `fetchOnce()` does `fetch(`${environment.wsHost}/status`)` and stores the result; warning-level issues are printed via `console.warn` per issue; error-level issues set `serverStatus$.status = 'error'`.

**Bootstrap hook** in `angular-frontend/src/main.ts`
- Before the existing `validateStoredToken()` call, `await serverStatusService.fetchOnce()`. If the result is `error`, navigate to `/server-status` and skip socket connect.

**Route + guard** `angular-frontend/src/app/server-status/server-status.component.ts` and `.../server-status.routes.ts`
- New standalone component listing each issue (level chip, code, message). Mounted at `/server-status` in `app.routes.ts`.
- New `serverHealthGuard` (mirror of `auth.guard.ts`): `canActivate` returns `true` when `serverStatus$.status !== 'error'`, otherwise `router.createUrlTree(['/server-status'])`. Apply to `lobby` (and any other authed routes) so a mid-session error reroutes the user.

If the fetch fails (network error), treat it as `error` with a synthetic `SERVER_UNREACHABLE` issue so the user lands on `/server-status` rather than a broken UI.

### 10. Documentation — `server/.env-example`

Add a new section above `## Authentication`:

```
## Storage backend

# Unified storage backend. Allowed values: 'kv' | 'supabase'.
# When set, drives BOTH auth (sessions, users, registration codes) and
# game data (match-configuration saves). Takes precedence over the
# deprecated AUTH_SESSION_STORE / GAME_DATA_STORE vars below.
STORAGE_BACKEND=

# Required when STORAGE_BACKEND=supabase.
SUPABASE_URL=
# Service-role key (server-side only — bypasses RLS). NEVER expose to browser.
SUPABASE_SERVICE_ROLE_KEY=
```

Mark the existing `AUTH_SESSION_STORE` / `AUTH_KV_PATH` / `GAME_DATA_STORE` / `GAME_DATA_KV_PATH` lines as `# DEPRECATED — use STORAGE_BACKEND. Honored as a fallback with a warning.`

## Files to create

- `supabase/migrations/<timestamp>_create_storage_schema.sql`
- `server/src/core/storage/supabase-client-provider.ts`
- `server/src/core/auth/supabase-user-store.ts`
- `server/src/core/auth/supabase-session-store.ts`
- `server/src/core/auth/supabase-registration-code-store.ts`
- `server/src/core/supabase-match-configuration-save-service.ts`
- `server/src/core/server-health-service.ts`
- `server/src/core/server-status-route-handler-service.ts`
- `server/scripts/migrate-kv-to-supabase.ts`
- `angular-frontend/src/app/core/server-status/server-status.service.ts`
- `angular-frontend/src/app/core/guards/server-health.guard.ts`
- `angular-frontend/src/app/server-status/server-status.component.ts`

## Files to modify

- `server/src/core/auth/user-store.ts` — `create` returns `Promise<UserRecord>`.
- `server/src/core/auth/in-memory-user-store.ts` and `deno-kv-user-store.ts` — wrap `create` return in `Promise.resolve`.
- `server/src/core/auth/server-auth-route-handler-service.ts:439` — `await userStore.create(...)`.
- `server/scripts/auth-user-mgmt.ts` — `await store.create(...)`; backend selection via new resolver.
- `server/src/core/server-config-service.ts` — add `getStorageBackend`, `resolveStorageConfig`, `getSupabaseUrl`, `getSupabaseServiceRoleKey`; rewire `validate()`.
- `server/src/composition/register-root-services.ts` — use `resolveStorageConfig()` in all four store factories; register Supabase client provider, health service, status route handler.
- `server/src/core/server-startup-service.ts` — open Supabase client and prime caches when selected; push config issues into health service.
- `server/src/core/server-bootstrap-service.ts` — route `/status` first.
- `server/deno.json` — add `@supabase/supabase-js` import; add `migrate-kv-to-supabase` task.
- `server/.env-example` — document new vars; mark old vars deprecated.
- `angular-frontend/src/main.ts` — `await serverStatusService.fetchOnce()` before `validateStoredToken()`; redirect to `/server-status` on error.
- `angular-frontend/src/app/app.routes.ts` — add `/server-status` route; attach `serverHealthGuard` to authed routes.

## Patterns to reuse

- `AuthKvProvider` (`server/src/core/auth/auth-kv-provider.ts`) — template for `SupabaseClientProvider`.
- `DenoKvUserStore`, `DenoKvSessionStore`, `DenoKvRegistrationCodeStore`, `DenoKvMatchConfigurationSaveService` — write-through cache pattern; copy structure, swap KV calls for `supabase.from(...)` calls.
- Factory pattern at `register-root-services.ts:89-187` — copy the `if (kind === 'kv')` shape for the new `'supabase'` branch.
- KV open wiring at `server-startup-service.ts:46-71` — sibling branch for Supabase.
- `auth.guard.ts` (`angular-frontend/src/app/core/guards/auth.guard.ts`) — template for `serverHealthGuard`.
- `auth.service.ts` raw-fetch pattern (`angular-frontend/src/app/core/auth/auth.service.ts`) — template for `serverStatusService.fetchOnce()`.
- `main.ts` bootstrap chain — extend the existing `.then(async appRef => ...)` block to add the status check before token validation.

## Verification

1. **Type check & lint** — `cd server && deno check --no-lock src/server.ts && deno lint src/`. Frontend: `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit`.
2. **Apply schema** — `supabase db push`. Confirm four tables in Supabase Studio.
3. **Configure env** — set `STORAGE_BACKEND=supabase`, `SUPABASE_URL=...`, `SUPABASE_SERVICE_ROLE_KEY=...` in `server/.env`. Leave the deprecated vars unset.
4. **Healthy path** — start server (`deno task dev:watch`); `curl http://localhost:3001/status` → `{ status: 'healthy', issues: [], backend: 'supabase' }`. Frontend boots normally.
5. **Deprecation warning** — unset `STORAGE_BACKEND`, set `AUTH_SESSION_STORE=kv` and `GAME_DATA_STORE=kv`. Restart. `/status` returns `warning` with `STORAGE_BACKEND_LEGACY_USED`. Frontend boots; the warning appears in the browser console.
6. **Conflict warning** — set both `STORAGE_BACKEND=supabase` and `AUTH_SESSION_STORE=kv`. Restart. Server log warns; `/status` returns `warning` with `STORAGE_BACKEND_OVERRIDE`; backend resolves to `supabase`.
7. **Error gating** — set `STORAGE_BACKEND=supabase` but leave `SUPABASE_URL` empty. Restart. `/status` returns `error` with `SUPABASE_CONFIG_INVALID`. Frontend redirects to `/server-status` and shows the issue list; lobby/login routes are blocked by `serverHealthGuard`.
8. **End-to-end auth** — restore healthy supabase config; register a user via the frontend → row appears in `auth_users`; log in → row appears in `auth_sessions`; restart server, confirm session persists; issue a registration code → row in `auth_registration_codes`; create a match-config save in lobby → row in `match_configuration_saves`.
9. **Migration script** — with an existing `auth.kv` file present and `STORAGE_BACKEND=supabase` configured, run `deno task migrate-kv-to-supabase`. Verify all rows appear in Supabase and the script prints the `setval` SQL to run for the user-id sequence. Re-run to confirm idempotence.
10. **Backwards regression** — unset `STORAGE_BACKEND` and unset all deprecated vars. Server starts, `/status` returns `warning` with `STORAGE_BACKEND_MISSING`, backend resolves to memory+file (historical defaults). Existing dev workflows keep working.
