---
date: 2026-04-16
repository: card-game
branch: develop
git_commit: 212f0f9e59be89c08051a5863f4e78ff605c4a97
topic: "Authentication & session management: login flow and session persistence"
tags: [authentication, login, session, auth-provider, socket-auth, bcrypt, cors]
status: complete
last_updated: 2026-04-16
last_updated_by: research
---

# Authentication & Session Management Research

## Research Question

How does authentication currently work for logging into the app and maintaining a user's session?

## Summary

The app implements a **simple, in-memory, provider-based authentication system** designed around a pluggable `AuthProvider` contract. Today a single provider is registered — `PresetPasswordAuthProvider` — which validates credentials against a single bcrypt-hashed shared password read from the `AUTH_PASSWORD` environment variable. Sessions are represented by UUID tokens held in a `Map<token, username>` inside `AuthSessionService` (no database, no JWT, no expiry). The Angular client persists the token and the entered username in `localStorage`, transitions through a dedicated `login` scene (driven by a nanostores atom rather than Angular Router), and sends the token to the server twice: once via the `POST /auth/login` HTTP handshake and again on every socket.io connection via the `auth` callback. The server validates the token before accepting the socket connection. The username entered at login becomes the player's display name and is passed through the lobby/join pipeline to `PlayerFactoryService.createPlayer()`. Sessions are lost on server restart (in-memory store) and cleared explicitly by `DELETE /auth/logout` or client-side `clearAuth()`.

A full implementation plan covering all four phases lives at `thoughts/shared/plans/2026-03-27-simple-authentication.md`.

## Detailed Findings

### 1. High-Level Architecture

The auth system is split into three concerns:

1. **Provider registry & session store** (server): `AuthSessionService` owns `Map<token, username>` for sessions and `Map<providerName, AuthProvider>` for pluggable credential validators.
2. **HTTP endpoint handler** (server): `ServerAuthRouteHandlerService` handles `POST /auth/login`, `GET /auth/validate`, `DELETE /auth/logout`, plus CORS preflight.
3. **Client-side auth state** (Angular): `AuthService` + two nanostores atoms (`authTokenStore`, `authUsernameStore`) + `localStorage`.

The Angular app never uses Angular Router for main scene switching; a single `sceneStore` atom (values `'login' | 'lobby' | 'configuration' | 'match' | 'gameSummary'`) drives `<ng-container [ngSwitch]>` in `app.component.html`. `'login'` is the default scene on app load.

Socket authentication is provider-agnostic — it only verifies that the token maps to a username in `AuthSessionService.sessions`.

### 2. Server-Side Implementation

#### 2.1 `AuthProvider` interface (contract)

File: `server/src/core/auth/auth-provider.ts:23-38`

```typescript
export interface AuthProvider {
  readonly name: string;
  authenticate(credentials: Record<string, unknown>): Promise<AuthResult>;
  initialize?(): Promise<void>;
}
```

`AuthResult` is a discriminated union: `{ ok: true; username: string } | { ok: false; message: string }` (`auth-provider.ts:7-9`).

Per the doc comment, to add a new auth method you (1) create a class implementing the interface, (2) register it in DI, and (3) register it with `AuthSessionService` during startup (`auth-provider.ts:18-22`).

#### 2.2 `AuthSessionService` (singleton orchestrator)

File: `server/src/core/auth/auth-session-service.ts`

- Holds `sessions: Map<string, string>` (token → username) and `providers: Map<string, AuthProvider>` (`auth-session-service.ts:15-18`).
- `registerProvider(provider)` adds a provider; duplicate names warn and skip (`:30-38`).
- `initializeProviders()` loops registered providers and awaits each optional `initialize()` (`:46-54`).
- `login(providerName, credentials)` looks up the provider, calls `authenticate`, and on success creates a token via `crypto.randomUUID()`, stores it, and returns `{ ok: true, token, username }`. Unknown providers return `{ ok: false, message: 'Unknown authentication provider' }`. (`:62-82`).
- `validateToken(token)` returns the username from the map or `undefined` (`:89-91`).
- `removeSession(token)` deletes the entry (`:98-100`).

Lifetime is documented as "Root singleton — shared across all connections" (`:12`).

#### 2.3 `PresetPasswordAuthProvider`

File: `server/src/core/auth/preset-password-auth-provider.ts`

- `readonly name = 'password'` — the provider key used in login requests (`:19`).
- On `initialize()`: reads `AUTH_PASSWORD` via `ServerConfigService.getAuthPassword()`. If blank, sets `noPassword = true` and logs "password check disabled". Otherwise `bcrypt.hash()`s the password and stores the hash in memory (`:39-48`).
- On `authenticate(credentials)`:
  - Trims `credentials['username']`; empty → reject with generic `'Username/password does not match'` (`:58-63`).
  - If `noPassword`: accept any non-empty username (`:65-68`).
  - Otherwise `bcrypt.compare(password, this.passwordHash)`. Failure returns the same generic error message to avoid leaking which field was wrong (`:75-80`).

The bcrypt dependency is imported via the Deno imports map: `"bcrypt": "https://deno.land/x/bcrypt@v0.4.1/mod.ts"` (`server/deno.json:70`).

#### 2.4 `ServerAuthRouteHandlerService` (HTTP endpoint handler)

File: `server/src/core/auth/server-auth-route-handler-service.ts`

Routes (see class docblock at `:7-10`):
- `POST   /auth/login`    — validates via a selectable provider, returns token
- `GET    /auth/validate` — validates an existing Bearer token
- `DELETE /auth/logout`   — invalidates a Bearer token (idempotent)
- `OPTIONS` (any path under `/auth`) — CORS preflight returning 204

`handleRequest(req, url)` returns `undefined` when the path doesn't start with `/auth`, letting the bootstrap fall through to debug/socket handlers (`:34-37`). Known `/auth` paths are routed by `[parts.length === 2 && parts[1] === 'login'|'validate'|'logout']` combined with method match (`:47-60`).

CORS handling (`:172-180`) echoes the request `Origin` back as `access-control-allow-origin`, exposes `Content-Type, Authorization` headers, and permits `GET, POST, DELETE, OPTIONS`. All responses (including 404 and error JSON) are returned with CORS headers. The rationale in the docblock (`:28-32`) is that the Angular frontend may be served from a different origin than the game server in production (separate Azure Container Apps).

Login flow (`handleLogin`, `:73-101`):
1. Parses JSON body. Malformed JSON → `400 invalid json`.
2. Reads `body['provider']`; defaults to `'password'` when unset (`:88`).
3. Calls `authSessionService.login(providerName, body)`. Passes the **entire body** as credentials — the provider picks out the fields it needs.
4. Returns `{ ok: true, token, username }` at 200, or `{ ok: false, message }` at 401.

Validate (`handleValidate`, `:108-123`): pulls `Authorization: Bearer <token>`, looks up via `authSessionService.validateToken`. 401 when header is missing or the token is unknown; 200 with `{ ok: true, username }` on success.

Logout (`handleLogout`, `:131-140`): extracts the Bearer token and calls `removeSession(token)`. Returns `{ ok: true }` (200) regardless of whether the token existed — idempotent.

Bearer extraction (`extractBearerToken`, `:147-153`): requires `authHeader?.startsWith('Bearer ')` then slices 7 chars and trims.

#### 2.5 `ServerConfigService` – `AUTH_PASSWORD`

File: `server/src/core/server-config-service.ts`

- `getAuthPassword()` reads `Deno.env.get('AUTH_PASSWORD') ?? ''` — returns empty string when unset or blank (`:23-25`). **Does not throw** when missing; empty string signals the provider to run in "no password" mode.
- `validate()` calls `getAuthPassword()` during startup, but since the method can't throw, this is effectively a no-op for AUTH_PASSWORD (`:8`).

Example env files:
- `server/.env-example:11` → `AUTH_PASSWORD=dominion`
- `docker-compose.dev.yml:42` → `AUTH_PASSWORD=` (empty → no-password mode)
- `docker-compose.prod.yml:13` → `AUTH_PASSWORD: "dominion"`
- Azure production: documented in `docs/azure-operations.md:148` as a secret-backed environment variable.

#### 2.6 DI registration

File: `server/src/composition/register-root-services.ts:98-100`

```typescript
authSessionService: asClass(AuthSessionService).singleton(),
presetPasswordAuthProvider: asClass(PresetPasswordAuthProvider).singleton(),
serverAuthRouteHandlerService: asClass(ServerAuthRouteHandlerService).singleton(),
```

All three are singletons in the root Awilix container (`InjectionMode.CLASSIC`). `AuthSessionService` takes `LoggerService`; `PresetPasswordAuthProvider` takes `LoggerService` + `ServerConfigService`; `ServerAuthRouteHandlerService` takes `AuthSessionService` + `LoggerService`.

Imports at the top of `register-root-services.ts:38-40`.

#### 2.7 Startup wiring

File: `server/src/core/server-startup-service.ts:19-23`

```typescript
public async start(): Promise<void> {
  this.authSessionService.registerProvider(this.presetPasswordAuthProvider);
  await this.authSessionService.initializeProviders();
  // ... expansion loading follows
}
```

The provider is registered and initialized **before** expansions load. Both `AuthSessionService` and `PresetPasswordAuthProvider` are injected into `ServerStartupService`'s constructor (`:10-16`).

#### 2.8 HTTP routing priority

File: `server/src/core/server-bootstrap-service.ts:47-59`

```typescript
Deno.serve({
  port: this.serverConfigService.getPort(),
  signal: this.shutdownController.signal,
  handler: (req, info) => {
    const url = new URL(req.url);
    // Auth routes take priority over debug and socket.io.
    const authResponse = this.serverAuthRouteHandlerService.handleRequest(req, url);
    if (authResponse) {
      return authResponse;
    }
    return this.serverDebugRouteHandlerService.handleRequest(req, info);
  },
});
```

Auth requests are checked first, then `ServerDebugRouteHandlerService` handles `/debug/*` and everything else (including socket.io upgrade traffic).

#### 2.9 Socket gateway validation

File: `server/src/core/server-socket-gateway-service.ts`

The socket connection handler reads two values from the handshake:
- `sessionId` from `socket.handshake.query` (`:39`)
- `authToken` from `socket.handshake.auth['authToken']` — **not query** (`:40-42`)

The docblock at `:40-41` notes: "Auth token is sent via socket.io auth (callback form) so it is read from localStorage at connection time rather than at socket construction."

Validation sequence (`:45-69`):
1. Missing `sessionId` → log error + `socket.disconnect()`.
2. Missing `authToken` → log error + `socket.disconnect()`.
3. `authSessionService.validateToken(authToken)` → `undefined` means invalid, disconnect.
4. Success → `lobbyDirectoryService.registerConnection(sessionId, socket, username)` — the **validated username from the token** is passed through, not the client-sent one.

### 3. Frontend Implementation

#### 3.1 `AuthService`

File: `angular-frontend/src/app/core/auth/auth.service.ts`

Two nanostores atoms declared at module load (`:5-13`):

```typescript
export const authUsernameStore = atom<string | undefined>(
  localStorage.getItem('authUsername') ?? undefined,
);
export const authTokenStore = atom<string | undefined>(
  localStorage.getItem('authToken') ?? undefined,
);
```

Both are also exposed on `globalThis` for console debugging (`:15-16`), matching the project's established pattern for state stores.

Methods:
- `login(credentials, provider = 'password')` at `:33-57` — `POST ${environment.wsHost}/auth/login` with `{ ...credentials, provider }`. On 200 & `body.ok`, writes `authToken` and `authUsername` to `localStorage` and to both atoms. Returns `{ ok: boolean; message? }`.
- `validateStoredToken()` at `:64-88` — if `authTokenStore.get()` is defined, `GET ${environment.wsHost}/auth/validate` with `Authorization: Bearer <token>`. On success, updates `authUsernameStore` from the server response. On failure, calls `clearAuth()` and returns false.
- `clearAuth()` at `:93-98` — removes both `localStorage` keys and sets both atoms to `undefined`.
- `logout()` at `:104-117` — best-effort `DELETE ${environment.wsHost}/auth/logout` with the token. Network errors are swallowed; `clearAuth()` is always called.

All HTTP calls go to `${environment.wsHost}` (absolute URL) rather than relative paths. `environment.wsHost` at `angular-frontend/src/environments/environment.ts:2` reads `(window as any).__env?.wsHost ?? 'http://localhost:3000'`. In dev this is usually populated via `env.js` generated in `public/`; in Docker the value is an empty string so the Angular dev-server proxy takes effect (`docker-compose.dev.yml:18`).

Recent commit `22d24c4c` made these URLs absolute: "fix auth api calls to use absolute server url and add cors headers".

#### 3.2 `LoginComponent`

File: `angular-frontend/src/app/components/login/login.component.ts`

- Standalone component, `ChangeDetectionStrategy.OnPush`, inputs via Angular signals (`username`, `password`, `errorMessage`, `isSubmitting`, `showPassword`).
- `toggleShowPassword()` toggles the `showPassword` signal (`:33-35`); template binds `[type]="showPassword() ? 'text' : 'password'"` on the password input (`login.component.html:20`).
- `onSubmit()` (`:41-64`):
  1. Clears error.
  2. Local validation: empty username or password → set generic error message, return early.
  3. Calls `_authService.login({ username: trimmed, password }, 'password')`.
  4. On `result.ok` → `sceneStore.set('lobby')`.
  5. On failure → set `errorMessage` to `'Username/password does not match'` (generic on purpose).
  6. `finally` → reset `isSubmitting`.

The template (`login.component.html`) is wrapped in `<app-scene-content>` so the scene banner renders above the centered form. It includes eye/eye-slash SVGs for the password toggle button.

#### 3.3 Scene system & default scene

File: `angular-frontend/src/app/state/game-state.ts:42-45`

```typescript
export type SceneNames = 'login' | 'lobby' | 'configuration' | 'match' | 'gameSummary';
export const sceneStore = atom<SceneNames>('login');
```

`AppComponent` imports `LoginComponent` (`app.component.ts:21,43`) and renders it via `<app-login *ngSwitchCase="'login'"></app-login>` in `app.component.html:2`.

#### 3.4 Socket handshake with auth

File: `angular-frontend/src/app/core/socket-service/socket.service.ts`

`SocketService` constructor (`:16-43`):
- Reads or creates a `sessionId` in `localStorage` via `uuidV4()` (`:17-23`).
- Creates the socket with `autoConnect: false` so handlers can be wired before connecting (`:29`).
- Passes `sessionId` via `query` (`:32`).
- Passes `authToken` via the `auth` **callback form** (`:35-38`):

```typescript
auth: (cb: (data: Record<string, string>) => void) => {
  const token = localStorage.getItem('authToken');
  cb(token ? { authToken: token } : {});
},
```

The comment at `:33-34` explains: "Use a callback so the token is read from localStorage at connection time, not at construction time (when the user may not yet be authenticated)." This is notable — the commit history shows `37c1a5bd` "fix socket auth token sent via auth callback, not query" changed this from the originally planned query-based approach.

`setEventMap(map)` (`:59-72`) wires event handlers and then calls `_socket.connect()` once, triggering the handshake.

Public methods added for auth flow:
- `isConnected()` (`:115-117`) — returns `_socket.connected`.
- `disconnect()` (`:122-124`) — calls `_socket.disconnect()`.

#### 3.5 Bootstrap flow

File: `angular-frontend/src/main.ts`

```typescript
bootstrapApplication(AppComponent, appConfig)
  .then(async appRef => {
    const injector = appRef.injector;
    const authService = injector.get(AuthService);
    const socketService = injector.get(SocketService);

    // Guard against double-init
    let socketInitialized = false;

    const connectSocket = () => {
      if (socketInitialized) return;
      socketInitialized = true;
      socketService.setEventMap(socketToGameEventMap());
      socketService.emit('requestSelectableSearchCatalog');
    };

    const hasValidToken = await authService.validateStoredToken();
    if (hasValidToken) {
      sceneStore.set('lobby');
      connectSocket();
    }

    authTokenStore.subscribe(token => {
      if (token) {
        connectSocket();
      }
    });
  });
```

Sequence on load (`main.ts:28-44`):
1. App bootstraps with `sceneStore = 'login'` (from the atom default).
2. `validateStoredToken()` runs: if `authToken` is in `localStorage`, hits `GET /auth/validate`.
3. Valid token → `sceneStore.set('lobby')` and `connectSocket()`.
4. Invalid/missing token → stay on login scene, do not connect socket.
5. Any later token write (via `login()`) triggers `authTokenStore.subscribe` which calls `connectSocket()`.

The `socketInitialized` guard (`:18, 20-26`) is explicitly documented: `authTokenStore.subscribe` fires immediately with the current value, so without the guard `connectSocket()` would run twice on refresh. (`main.ts:15-17`, `:38-39`.)

Note: The comment at `:31-33` says "Server events will correct the scene if the user was in configuration or match (`matchConfigurationUpdated` / `matchReady`)." This is the Phase-4 scene-restoration behavior — `LobbyDirectoryService.registerConnection` checks for an active game before emitting `lobbySnapshot` (see §5).

#### 3.6 Logout flow

File: `angular-frontend/src/app/components/lobby/lobby.component.ts:54-58`

```typescript
async logout(): Promise<void> {
  await this._authService.logout();
  this._socketService.disconnect();
  sceneStore.set('login');
}
```

The Logout button is projected into the scene banner's `sceneHeaderActions` slot: `lobby.component.html:2-4`:

```html
<button sceneHeaderActions type="button" class="logout-button" (click)="logout()">
  Logout
</button>
```

Effect: server token invalidated → socket disconnected → scene reset to login. On next connect attempt (via login), `socketInitialized` won't be reset, but the socket object itself is the same and can be reconnected via `_socket.connect()` in `setEventMap`. (A fresh login calls `authTokenStore.subscribe` → `connectSocket()` — the guard prevents re-registering handlers, but since the existing `_socket` is already disconnected, `setEventMap → _socket.connect()` reconnects it.)

### 4. End-to-End Login Flow

1. User loads `http://<host>/` — Angular bootstraps.
2. `sceneStore` defaults to `'login'`. `AppComponent` renders `<app-login>`.
3. `main.ts` runs `validateStoredToken()`:
   - If no token → stays on login, socket not connected.
   - If token valid → `sceneStore.set('lobby')`, `connectSocket()` fires, socket handshake occurs with the stored token.
4. User enters username + password → `LoginComponent.onSubmit()`.
5. `AuthService.login({ username, password }, 'password')` → `POST ${wsHost}/auth/login` with JSON body `{ username, password, provider: 'password' }`.
6. `ServerBootstrapService` handler routes to `ServerAuthRouteHandlerService.handleRequest(req, url)` (`:53`).
7. `ServerAuthRouteHandlerService.handleLogin()` parses JSON, extracts `provider = 'password'`, calls `authSessionService.login('password', body)`.
8. `AuthSessionService.login` looks up the `'password'` provider and delegates to `PresetPasswordAuthProvider.authenticate(body)`.
9. Provider trims username, `bcrypt.compare(password, passwordHash)`. Success → `{ ok: true, username }`.
10. Back in `AuthSessionService.login`: creates `token = crypto.randomUUID()`, stores `sessions.set(token, username)`, returns `{ ok: true, token, username }`.
11. `ServerAuthRouteHandlerService` returns 200 JSON `{ ok: true, token, username }`.
12. `AuthService` writes token and username to `localStorage` and to both atoms.
13. `LoginComponent` sees `result.ok` → `sceneStore.set('lobby')`.
14. `authTokenStore.subscribe` (in `main.ts`) fires → `connectSocket()` → socket.io opens handshake carrying `sessionId` (query) and `authToken` (auth callback).
15. `ServerSocketGatewayService` on `connection`: extracts both, validates token via `AuthSessionService.validateToken`, gets username back. Calls `lobbyDirectoryService.registerConnection(sessionId, socket, username)`.
16. `LobbyDirectoryService` stores `sessionToUsername`, joins lobby room, emits lobby snapshot (or reconnects to active game — see §5).

### 5. Session Persistence & Scene Restoration

Session survives page refresh because:
- `localStorage` keys `authToken`, `authUsername`, and `sessionId` all persist.
- The server's in-memory `Map<token, username>` persists as long as the server process is alive.
- `main.ts` revalidates the stored token on every load.

**Scene restoration on refresh** (Phase 4 feature):

File: `server/src/core/lobby-directory-service.ts:209-227`

```typescript
public registerConnection(sessionId: string, socket: AppSocket, username: string): void {
  this.loggerService.info(`[lobby directory] registering session ${sessionId} (username: ${username})`);
  this.sessionToUsername.set(sessionId, username);
  socket.join(LobbyDirectoryService.LOBBY_ROOM_NAME);
  this.registerLobbyHandlers(sessionId, socket);

  // Check for an active game FIRST to avoid a brief flash of the lobby scene
  // before server events redirect the client to configuration/match.
  const gameId = this.findGameIdForSession(sessionId);
  if (gameId) {
    this.loggerService.info(`[lobby directory] session ${sessionId} reconnecting to game ${gameId}`);
    this.joinLobbyGame(sessionId, socket, gameId);
    return;
  }

  // No active game — show lobby.
  this.emitLobbySnapshot(socket);
  this.emitSelectableSearchCatalog(socket);
}
```

The order is: bind handlers → check active game → if found, rejoin it (skip lobby snapshot entirely). `findGameIdForSession` scans `sessionToGameId` and then falls back to looking at each game's player list. When the user reconnects, the server drives them back to `configuration` or `match` via the game's state events (`matchConfigurationUpdated`, `matchReady`).

### 6. Username as Player Name

The authenticated username becomes the immutable display name across the game (Phase 4 in the plan).

Path:
1. `ServerSocketGatewayService.registerConnection` calls `lobbyDirectoryService.registerConnection(sessionId, socket, username)` (`:68`).
2. `LobbyDirectoryService.sessionToUsername.set(sessionId, username)` stores it (`:211`).
3. On `joinLobbyGame`, the username is looked up and passed to `record.game.addPlayer(sessionId, socket, username)` (`:510-511`):

```typescript
const username = this.sessionToUsername.get(sessionId) ?? 'Player';
const addResult = record.game.addPlayer(sessionId, socket, username);
```

4. This flows through `GameLobbySessionCoordinatorService` → `PlayerRegistryService.registerPlayerJoin({ ..., username })` (`player-registry-service.ts:20-52`). Existing players keep their slot without updating name; new players go to `playerFactoryService.createPlayer(sessionId, socket, username)`.
5. `PlayerFactoryService.createPlayer(sessionId, socket, username?)` at `player-factory-service.ts:13-26`:

```typescript
const player = new Player({
  name: username || `Player ${newId}`,
  // ...
});
```

The UI-side player-name component (`player-name-input.component.ts`) was simplified to a read-only span — no editable input, no debounced `updatePlayerName` socket emit (Phase 4).

### 7. CORS

All auth responses include CORS headers via `ServerAuthRouteHandlerService.corsHeaders(req)` (`:172-180`):
- `access-control-allow-origin`: echoes request `Origin` header, falls back to `*`.
- `access-control-allow-methods`: `GET, POST, DELETE, OPTIONS`.
- `access-control-allow-headers`: `Content-Type, Authorization`.
- `access-control-max-age`: `86400`.

OPTIONS preflight returns `204` with only the CORS headers (`:41-43`). Required because in production the Angular container and server container may be on different origins (Azure Container Apps).

In dev, the Angular dev server proxies `/auth/**` → `http://127.0.0.1:3001` via `angular-frontend/src/proxy.conf.json:2-7`. The Docker dev override at `proxy.conf.docker.json` targets the `server` service DNS name instead.

### 8. What the System Is NOT

From the implementation plan's "What We're NOT Doing" section (`thoughts/shared/plans/2026-03-27-simple-authentication.md:61-68`):
- No user registration or persistent user accounts.
- No database storage — auth state is in-memory on the server (lost on restart).
- No JWT tokens — simple UUID-based session tokens.
- No password change UI.
- No rate limiting on login attempts.
- No HTTPS enforcement (delegated to infrastructure).
- No additional auth providers beyond preset password (architecture supports them; not implemented).

### 9. Key Code References

Server:
- `server/src/core/auth/auth-provider.ts:23-38` — `AuthProvider` interface & `AuthResult` type.
- `server/src/core/auth/auth-session-service.ts:14-101` — Session store, provider registry, `login`/`validateToken`/`removeSession`.
- `server/src/core/auth/preset-password-auth-provider.ts:17-84` — bcrypt-based provider, no-password mode.
- `server/src/core/auth/server-auth-route-handler-service.ts:34-181` — HTTP router for `/auth/*` with CORS.
- `server/src/core/server-config-service.ts:23-25` — `getAuthPassword()` env reader.
- `server/src/core/server-bootstrap-service.ts:47-59` — Auth routes prioritized in the `Deno.serve` handler.
- `server/src/core/server-socket-gateway-service.ts:36-70` — Socket handshake validation.
- `server/src/core/server-startup-service.ts:19-23` — Provider registration & initialization at startup.
- `server/src/composition/register-root-services.ts:98-100` — DI registration.
- `server/src/core/lobby-directory-service.ts:209-227` — Session registration + scene restoration.
- `server/src/core/lobby-directory-service.ts:510-511` — Username passed to `game.addPlayer`.
- `server/src/core/player-registry-service.ts:20-52` — Username flows into `registerPlayerJoin`.
- `server/src/core/player-factory-service.ts:13-26` — `createPlayer(..., username?)`.
- `server/deno.json:70` — bcrypt import.

Frontend:
- `angular-frontend/src/app/core/auth/auth.service.ts:5-16` — `authTokenStore`, `authUsernameStore` atoms, globalThis binding.
- `angular-frontend/src/app/core/auth/auth.service.ts:33-117` — `login`, `validateStoredToken`, `clearAuth`, `logout`.
- `angular-frontend/src/app/components/login/login.component.ts:22-65` — Login component, signals, submit flow.
- `angular-frontend/src/app/components/login/login.component.html:1-61` — Form markup with password visibility toggle.
- `angular-frontend/src/app/state/game-state.ts:42-45` — `SceneNames` type with `'login'`, default scene atom.
- `angular-frontend/src/app/app.component.ts:21,43` and `app.component.html:2` — `LoginComponent` registration and scene case.
- `angular-frontend/src/app/core/socket-service/socket.service.ts:16-43` — Handshake with `sessionId` + auth callback.
- `angular-frontend/src/app/core/socket-service/socket.service.ts:115-124` — `isConnected`, `disconnect`.
- `angular-frontend/src/main.ts:9-46` — Bootstrap + token validation + socket connect gating.
- `angular-frontend/src/app/components/lobby/lobby.component.ts:22,54-58` — Logout method and AuthService injection.
- `angular-frontend/src/app/components/lobby/lobby.component.html:2-4` — Logout button projection.

Configuration:
- `server/.env-example:11` — `AUTH_PASSWORD=dominion`.
- `docker-compose.dev.yml:42` — Empty `AUTH_PASSWORD=` in dev Docker.
- `docker-compose.prod.yml:13` — `AUTH_PASSWORD: "dominion"` in prod Docker.
- `docs/azure-operations.md:148` — `AUTH_PASSWORD` is a secret-backed env var in Azure.
- `angular-frontend/src/proxy.conf.json:2-7` — `/auth/**` dev proxy.
- `angular-frontend/src/proxy.conf.docker.json:2-7` — `/auth/**` Docker dev proxy.

Plan & prior research:
- `thoughts/shared/plans/2026-03-27-simple-authentication.md` — Full 4-phase implementation plan (final implementation notes added post-implementation, per commit `11cd1359`).

Shared types:
- `shared/src/shared-types.ts` — `sessionId` field on `Player`/`PlayerArgs` (~line 549, 557); `playerNameUpdated`/`updatePlayerName` network events (~line 610-613, 658, 742-763) still exist in the type catalogue but the editable name UI path was removed in Phase 4.

Related but not auth-owned code:
- `server/src/core/player-reconnect-orchestrator.ts` — Reconnection flow that cooperates with `LobbyDirectoryService.registerConnection`.
- `server/src/core/game-lobby-session-coordinator-service.ts` — Receives the `username` argument from `Game.addPlayer` and threads it into `PlayerRegistryService.registerPlayerJoin`.
- `server/src/testing/create-test-player.ts` — Test helper that also accepts auth-related fields for Player construction.

Tests:
- `server/src/core/__tests__/player-registry-service.spec.ts` — Was updated in commit `92d90be6` ("fix player registry tests to include username arg after phase 4 change") to pass the new `username` argument.
- `server/src/core/__tests__/player-session-service.spec.ts`, `player-factory-service.spec.ts`, `server-config-service.spec.ts`, `shared-types.spec.ts` — Existing tests that touch session/player fields.
- No dedicated unit tests exist for `AuthSessionService`, `PresetPasswordAuthProvider`, or `ServerAuthRouteHandlerService`.

### 11. Notable Absences

- **No HTTP interceptor or Angular route guard** — the client never attaches the Bearer token to arbitrary HTTP calls; only `AuthService` itself calls `/auth/*` with the Authorization header. Scene gating is done at the `sceneStore` atom level, not via `Router` guards (there is no Angular Router for main views — the `<router-outlet />` in `app.component.html` is unused).
- **No cookies** — everything is `localStorage`. No `Set-Cookie`, no `SameSite`, no CSRF token.
- **No JWT** — tokens are opaque `crypto.randomUUID()` strings with no claims, expiry, or signature.
- **No password hashing for user accounts** — there is exactly one password (the preset), stored as a single in-process bcrypt hash. There are no user records to hash against.
- **No dedicated CORS middleware** — CORS is handled inline by `ServerAuthRouteHandlerService.corsHeaders`. Debug and socket.io paths do not participate in this CORS logic (socket.io handles its own upgrade handshake).

### 10. Git History Context

Recent auth-related commits (descending):
- `22d24c4c` fix auth api calls to use absolute server url and add cors headers
- `92d90be6` fix player registry tests to include username arg after phase 4 change
- `9ce04a0d` phase 4 auth: username as player name, scene restore, password toggle
- `11cd1359` update auth plan with final implementation notes
- `37c1a5bd` fix socket auth token sent via auth callback, not query
- `2e87ad14` add simple authentication with login scene and logout

Four PRs merged from the `login-scene` branch (#10, #12, #14, #16) contain the rollout.

## Open Questions

- None raised by the research question itself — the system is fully implemented and documented. A deeper security audit, DoS consideration, or multi-provider expansion (OAuth/guest) would be separate investigations.
