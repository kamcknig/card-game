---
type: implementation-plan
repo: card-game
branch: develop
sha: e3d66d1655eb710585d28362f9685a719ff9e2a5
---

# Simple Authentication Implementation Plan

## Overview

Add a simple username/password authentication flow to the application. The login screen is a new `login` scene that gates access to the lobby. A single preset password is stored securely (hashed) on the server. The username entered becomes the player's display name in all games. Validation happens server-side via a new HTTP endpoint. The frontend stores a lightweight auth token in `localStorage` to persist sessions across refreshes.

The authentication system is designed with a **provider-based architecture** so additional authentication methods (e.g. OAuth, guest access, account-based) can be added alongside the preset password provider without restructuring existing code.

## Current State Analysis

- The frontend uses a scene-based system driven by `sceneStore` in `state/game-state.ts` (values: `lobby`, `configuration`, `match`, `gameSummary`).
- `AppComponent` uses `NgSwitch` on `scene()` to render scenes — no Angular Router for main views.
- The `SceneContentComponent` wraps scenes with a shared `SceneBannerComponent` (header with "Dominion Clone" title).
- The server handles HTTP requests via `ServerDebugRouteHandlerService.handleRequest()` which routes `/debug` paths and delegates everything else to socket.io.
- Socket connections require a `sessionId` from `localStorage`. No authentication currently exists.
- Player names are set via `updatePlayerName` socket event after joining a game.
- The server uses Awilix DI with `InjectionMode.CLASSIC` (constructor injection).
- The server uses Deno with `Deno.serve()` for HTTP.
- The server groups related services under subdirectories in `core/` (e.g. `core/tokens/`, `core/reactions/`, `core/events/`).

### Key Discoveries:
- Scene switching is at `angular-frontend/src/app/state/game-state.ts:45` via `sceneStore` atom
- `AppComponent` template at `angular-frontend/src/app/app.component.html:1-5` renders scenes via `NgSwitch`
- HTTP request handling at `server/src/core/server-debug-route-handler-service.ts:46` — all non-`/debug` paths go to socket.io
- Socket connection bootstrapped in `angular-frontend/src/main.ts:7-14` after Angular bootstraps
- Server bootstrap in `server/src/core/server-bootstrap-service.ts:45-49` uses `Deno.serve()`
- Theme variables defined at `angular-frontend/src/app/theme/app-theme.scss`
- Subdirectories in `core/` are an established pattern for grouping related services

## Desired End State

1. A `login` scene appears as the initial view when the app loads (instead of `lobby`).
2. The login scene has the same `SceneBannerComponent` header as lobby/configuration.
3. Centered login form with username field on top, password field on bottom, and a "Login" submit button.
4. On failed login, red error text appears below the password field: "Username/password does not match".
5. The server exposes a `POST /auth/login` endpoint that validates via a pluggable provider system.
6. On successful login, the server returns a simple token (session-based UUID) and the frontend stores it in `localStorage`.
7. The frontend includes the auth token in the socket.io handshake query. The server validates it on socket connection.
8. After successful login, the scene transitions to `lobby` and the username is stored for use as the player name.
9. On page refresh, if a valid auth token exists in `localStorage`, the login is bypassed.
10. The preset password is configured via the `AUTH_PASSWORD` environment variable (hashed at server startup).
11. The auth system uses an `AuthProvider` interface so new authentication methods can be added by implementing a new provider and registering it — no changes to the session layer, route handler, or socket validation.
12. The server exposes a `DELETE /auth/logout` endpoint that invalidates the auth token. The lobby scene has a "Logout" button in the banner actions area that calls this endpoint, clears `localStorage`, disconnects the socket, and returns to the login scene.

### Verification:
- Type-check frontend: `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit`
- Type-check server: `cd server && deno check --no-lock src/server.ts`
- Lint server: `cd server && deno lint src/`
- Manual: open the app, see login screen, login with correct password → lobby, login with wrong password → error message, logout button in lobby returns to login screen.

## What We're NOT Doing

- No user registration or persistent user accounts
- No database storage — auth state is in-memory on the server
- No JWT tokens — simple UUID-based session tokens
- No password change UI
- No rate limiting on login attempts
- No HTTPS enforcement (assumed to be handled by infrastructure)
- No additional auth providers beyond preset password (architecture supports it, implementation is future work)

## Implementation Approach

The work is split into 3 phases:

1. **Server auth provider system + endpoint**: Create the `AuthProvider` interface, `AuthSessionService`, `PresetPasswordAuthProvider`, auth route handler, and HTTP login endpoint — all grouped under `server/src/core/auth/`.
2. **Frontend login scene**: Create the login component, add `login` scene to the scene system, gate socket connection behind auth.
3. **Socket auth integration**: Pass the auth token on socket handshake and validate it server-side.

---

## Phase 1: Server Auth Provider System & HTTP Endpoint

### Overview
Create a modular server-side authentication system. An `AuthProvider` interface defines the contract for any auth method. `AuthSessionService` manages token-to-username sessions (shared across all providers). `PresetPasswordAuthProvider` is the first provider implementation. `ServerAuthRouteHandlerService` exposes HTTP endpoints that delegate to registered providers. All auth files live under `server/src/core/auth/`.

### Changes Required:

#### 1.1 Add bcrypt dependency

**File**: `server/deno.json`
**Changes**: Add bcrypt import to the imports map

```json
"imports": {
  // ... existing imports ...
  "bcrypt": "https://deno.land/x/bcrypt@v0.4.1/mod.ts"
}
```

#### 1.2 Create AuthProvider interface

**File**: `server/src/core/auth/auth-provider.ts` (new file)
**Changes**: Define the contract that all authentication providers must implement.

```typescript
/**
 * Result of an authentication attempt from a provider.
 *
 * Successful results include the authenticated username. Failed results
 * include an error message suitable for client display.
 */
export type AuthResult =
  | { ok: true; username: string }
  | { ok: false; message: string };

/**
 * Contract for pluggable authentication providers.
 *
 * Each provider handles one authentication method (e.g. preset password,
 * OAuth, guest access). Providers are registered with AuthSessionService
 * by name and invoked when a login request specifies that provider.
 *
 * To add a new auth method:
 * 1. Create a class implementing this interface
 * 2. Register it in the DI container
 * 3. Register it with AuthSessionService during startup
 */
export interface AuthProvider {
  /** Unique name for this provider (e.g. 'password', 'oauth', 'guest'). */
  readonly name: string;

  /**
   * Validates the given credentials and returns an AuthResult.
   * The shape of credentials varies by provider.
   */
  authenticate(credentials: Record<string, unknown>): Promise<AuthResult>;

  /**
   * Optional one-time initialization called during server startup.
   * Use for tasks like hashing a preset password or loading keys.
   */
  initialize?(): Promise<void>;
}
```

#### 1.3 Create AuthSessionService

**File**: `server/src/core/auth/auth-session-service.ts` (new file)
**Changes**: Manages auth sessions (token↔username mapping) and the provider registry. This is the central orchestrator — provider-agnostic.

```typescript
import { LoggerService } from '../logger-service.ts';
import { AuthProvider, AuthResult } from './auth-provider.ts';

/**
 * Manages auth sessions and delegates authentication to registered providers.
 *
 * Session management (token creation, validation, removal) is universal
 * across all auth methods. The provider registry allows new auth methods
 * to be added by registering an AuthProvider implementation.
 */
export class AuthSessionService {
  // Maps auth tokens to authenticated usernames.
  private readonly sessions = new Map<string, string>();
  // Maps provider names to their implementations.
  private readonly providers = new Map<string, AuthProvider>();

  constructor(
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Registers an auth provider. Call during server startup for each
   * supported auth method.
   */
  public registerProvider(provider: AuthProvider): void {
    if (this.providers.has(provider.name)) {
      this.loggerService.warn(`[auth] provider '${provider.name}' already registered, skipping`);
      return;
    }

    this.providers.set(provider.name, provider);
    this.loggerService.info(`[auth] registered provider '${provider.name}'`);
  }

  /**
   * Initializes all registered providers. Call once during server startup
   * after all providers are registered.
   */
  public async initializeProviders(): Promise<void> {
    for (const [name, provider] of this.providers) {
      if (provider.initialize) {
        this.loggerService.info(`[auth] initializing provider '${name}'`);
        await provider.initialize();
      }
    }
    this.loggerService.info(`[auth] all providers initialized (${this.providers.size} total)`);
  }

  /**
   * Attempts login via the named provider. Creates a session token on success.
   * Returns the token and username on success, or an error result on failure.
   */
  public async login(
    providerName: string,
    credentials: Record<string, unknown>,
  ): Promise<{ ok: true; token: string; username: string } | { ok: false; message: string }> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      this.loggerService.debug(`[auth] login rejected: unknown provider '${providerName}'`);
      return { ok: false, message: 'Unknown authentication provider' };
    }

    const result: AuthResult = await provider.authenticate(credentials);
    if (!result.ok) {
      this.loggerService.debug(`[auth] login rejected by provider '${providerName}': ${result.message}`);
      return result;
    }

    const token = crypto.randomUUID();
    this.sessions.set(token, result.username);
    this.loggerService.info(`[auth] login successful for '${result.username}' via '${providerName}'`);
    return { ok: true, token, username: result.username };
  }

  /**
   * Validates an auth token and returns the associated username, or undefined if invalid.
   */
  public validateToken(token: string): string | undefined {
    return this.sessions.get(token);
  }

  /**
   * Removes an auth session by token.
   */
  public removeSession(token: string): void {
    this.sessions.delete(token);
  }
}
```

#### 1.4 Create PresetPasswordAuthProvider

**File**: `server/src/core/auth/preset-password-auth-provider.ts` (new file)
**Changes**: Implements `AuthProvider` for preset password authentication.

```typescript
import { hash, compare } from 'bcrypt';
import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { AuthProvider, AuthResult } from './auth-provider.ts';

/**
 * Auth provider that validates against a single preset password.
 *
 * The password is read from the AUTH_PASSWORD environment variable and
 * bcrypt-hashed during initialization. Credentials must include
 * `username` (string) and `password` (string).
 */
export class PresetPasswordAuthProvider implements AuthProvider {
  readonly name = 'password';
  private passwordHash: string | undefined;

  constructor(
    private readonly loggerService: LoggerService,
    private readonly serverConfigService: ServerConfigService,
  ) {}

  /**
   * Hashes the preset password from the environment variable.
   */
  public async initialize(): Promise<void> {
    const presetPassword = this.serverConfigService.getAuthPassword();
    this.passwordHash = await hash(presetPassword);
    this.loggerService.info('[auth:password] preset password hashed');
  }

  /**
   * Validates username/password credentials against the preset password.
   */
  public async authenticate(credentials: Record<string, unknown>): Promise<AuthResult> {
    if (!this.passwordHash) {
      this.loggerService.error('[auth:password] authenticate called before initialization');
      return { ok: false, message: 'Authentication service not ready' };
    }

    const username = typeof credentials.username === 'string' ? credentials.username.trim() : '';
    const password = typeof credentials.password === 'string' ? credentials.password : '';

    if (!username) {
      this.loggerService.debug('[auth:password] rejected: empty username');
      return { ok: false, message: 'Username/password does not match' };
    }

    const valid = await compare(password, this.passwordHash);
    if (!valid) {
      this.loggerService.debug(`[auth:password] rejected for '${username}': invalid password`);
      return { ok: false, message: 'Username/password does not match' };
    }

    return { ok: true, username };
  }
}
```

#### 1.5 Add AUTH_PASSWORD to ServerConfigService

**File**: `server/src/core/server-config-service.ts`
**Changes**: Add `getAuthPassword()` method and include it in `validate()` — around line 6 add to validate, add new method after `getPort()`

```typescript
// In validate():
public validate(): void {
  this.getPort();
  this.getAuthPassword(); // ADD THIS LINE
  // ... rest of existing validations ...
}

// New method:
/**
 * Returns the preset authentication password from the AUTH_PASSWORD env var.
 * Required for server startup — throws if missing.
 */
public getAuthPassword(): string {
  const password = Deno.env.get('AUTH_PASSWORD');
  if (!password) {
    throw new Error('[server config] AUTH_PASSWORD environment variable is required');
  }
  return password;
}
```

#### 1.6 Create ServerAuthRouteHandlerService

**File**: `server/src/core/auth/server-auth-route-handler-service.ts` (new file)
**Changes**: Handles `POST /auth/login` and `GET /auth/validate` HTTP endpoints. Login requests include an optional `provider` field (defaults to `'password'`).

```typescript
import { AuthSessionService } from './auth-session-service.ts';
import { LoggerService } from '../logger-service.ts';

/**
 * Handles HTTP authentication endpoints for login and token validation.
 *
 * Login requests accept an optional `provider` field to select the
 * authentication method. Defaults to 'password' for backwards compatibility.
 * Token validation is provider-agnostic — it only checks the session store.
 */
export class ServerAuthRouteHandlerService {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Routes /auth/* HTTP requests to the appropriate handler.
   * Returns undefined if the path does not match an auth route.
   */
  public handleRequest(req: Request, url: URL): Response | Promise<Response> | undefined {
    if (!url.pathname.startsWith('/auth')) {
      return undefined;
    }

    const parts = url.pathname.split('/').filter(Boolean);

    // POST /auth/login
    if (parts.length === 2 && parts[1] === 'login' && req.method === 'POST') {
      return this.handleLogin(req);
    }

    // GET /auth/validate
    if (parts.length === 2 && parts[1] === 'validate' && req.method === 'GET') {
      return this.handleValidate(req);
    }

    return new Response('auth resource not found', { status: 404 });
  }

  /**
   * Validates credentials via the specified provider and returns an auth token on success.
   * The `provider` field in the request body selects the auth method (default: 'password').
   */
  private async handleLogin(req: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response('invalid json', { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return this.jsonResponse({ ok: false, message: 'invalid request body' }, 400);
    }

    // Default to 'password' provider for backwards compatibility.
    const providerName = typeof body.provider === 'string' ? body.provider : 'password';

    const result = await this.authSessionService.login(providerName, body);
    if (!result.ok) {
      return this.jsonResponse(result, 401);
    }

    return this.jsonResponse({
      ok: true,
      token: result.token,
      username: result.username,
    });
  }

  // Validates an existing auth token from the Authorization header.
  private handleValidate(req: Request): Response {
    const token = this.extractBearerToken(req);
    if (!token) {
      return this.jsonResponse({ ok: false, message: 'missing authorization header' }, 401);
    }

    const username = this.authSessionService.validateToken(token);
    if (!username) {
      return this.jsonResponse({ ok: false, message: 'invalid or expired token' }, 401);
    }

    return this.jsonResponse({ ok: true, username });
  }

  // Extracts a Bearer token from the Authorization header.
  private extractBearerToken(req: Request): string | undefined {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return undefined;
    }
    return authHeader.slice(7).trim() || undefined;
  }

  // Creates a consistent JSON HTTP response.
  private jsonResponse(payload: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }
}
```

#### 1.7 Register auth services in DI

**File**: `server/src/composition/register-root-services.ts`
**Changes**: Import and register all auth services

```typescript
// Add imports:
import { AuthSessionService } from '../core/auth/auth-session-service.ts';
import { PresetPasswordAuthProvider } from '../core/auth/preset-password-auth-provider.ts';
import { ServerAuthRouteHandlerService } from '../core/auth/server-auth-route-handler-service.ts';

// Add to container.register({...}):
authSessionService: asClass(AuthSessionService).singleton(),
presetPasswordAuthProvider: asClass(PresetPasswordAuthProvider).singleton(),
serverAuthRouteHandlerService: asClass(ServerAuthRouteHandlerService).singleton(),
```

#### 1.8 Initialize auth providers during startup

**File**: `server/src/core/server-startup-service.ts`
**Changes**: Inject `AuthSessionService` and `PresetPasswordAuthProvider`. Register the provider and initialize all providers before loading expansions.

```typescript
import { AuthSessionService } from './auth/auth-session-service.ts';
import { PresetPasswordAuthProvider } from './auth/preset-password-auth-provider.ts';

export class ServerStartupService {
  constructor(
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly expansionLoaderService: ExpansionLoaderService,
    private readonly loggerService: LoggerService,
    private readonly authSessionService: AuthSessionService,
    private readonly presetPasswordAuthProvider: PresetPasswordAuthProvider,
  ) {}

  public async start(): Promise<void> {
    // Register and initialize auth providers before anything else.
    this.authSessionService.registerProvider(this.presetPasswordAuthProvider);
    await this.authSessionService.initializeProviders();

    try {
      // ... existing expansion loading code unchanged ...
    }
  }
}
```

#### 1.9 Route /auth requests in ServerBootstrapService

**File**: `server/src/core/server-bootstrap-service.ts`
**Changes**: Inject `ServerAuthRouteHandlerService` and route auth requests before debug/socket.io.

```typescript
import { ServerAuthRouteHandlerService } from './auth/server-auth-route-handler-service.ts';

export class ServerBootstrapService {
  constructor(
    // ... existing params ...
    private readonly serverAuthRouteHandlerService: ServerAuthRouteHandlerService,
  ) {}

  public start(): void {
    // ... existing code up to Deno.serve ...

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

    // ... rest of existing code ...
  }
}
```

#### 1.10 Update environment configuration files

**File**: `server/.env-example`
**Changes**: Add `AUTH_PASSWORD` entry

```
# Preset password for simple authentication.
AUTH_PASSWORD=dominion
```

**File**: `docker-compose.dev.yml`
**Changes**: Add `AUTH_PASSWORD` to server environment

```yaml
environment:
  # ... existing vars ...
  - AUTH_PASSWORD=dominion
```

#### 1.11 Add /auth proxy rule to frontend dev proxy

**File**: `angular-frontend/src/proxy.conf.json`
**Changes**: Add `/auth/**` proxy rule to forward auth requests to the server

```json
{
  "/auth/**": {
    "target": "http://127.0.0.1:3001",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  },
  "/socket.io/**": { ... },
  "/debug/**": { ... }
}
```

#### 1.12 Add DELETE /auth/logout to ServerAuthRouteHandlerService [x]

**File**: `server/src/core/auth/server-auth-route-handler-service.ts` (already created in 1.6)
**Changes**: Add a `DELETE /auth/logout` route that extracts the Bearer token, removes the session, and returns 200. Add the route to `handleRequest()` and add the `handleLogout()` private method.

```typescript
// In handleRequest(), add after the validate branch:

// DELETE /auth/logout
if (parts.length === 2 && parts[1] === 'logout' && req.method === 'DELETE') {
  return this.handleLogout(req);
}

// New private method:
/**
 * Invalidates the auth session identified by the Bearer token.
 * Returns 200 even if the token was not found (idempotent).
 */
private handleLogout(req: Request): Response {
  const token = this.extractBearerToken(req);
  if (token) {
    this.authSessionService.removeSession(token);
    this.loggerService.info('[auth] logout: session removed');
  } else {
    this.loggerService.debug('[auth] logout: no bearer token provided');
  }
  return this.jsonResponse({ ok: true });
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Server type-checks: `cd server && deno check --no-lock src/server.ts`
- [ ] Server lints: `cd server && deno lint src/`

#### Manual Verification:
- [ ] `curl -s -X POST http://localhost:3001/auth/login -H 'Content-Type: application/json' -d '{"username":"test","password":"dominion"}'` returns `{"ok":true,"token":"<uuid>","username":"test"}`
- [ ] `curl -s http://localhost:3001/auth/validate -H 'Authorization: Bearer <token>'` returns `{"ok":true,"username":"test"}`
- [ ] `curl -s -X DELETE http://localhost:3001/auth/logout -H 'Authorization: Bearer <token>'` returns `{"ok":true}`
- [ ] Validate with the same token after logout returns `{"ok":false,...}` (401)

---

## Phase 2: Frontend Login Scene

### Overview
Create the Angular login component, add `login` as a scene, and gate the socket connection behind successful authentication. The login scene uses the same `SceneContentComponent` wrapper as lobby/configuration. The frontend auth service sends a `provider` field with login requests so the server routes to the correct provider.

### Changes Required:

#### 2.1 Create AuthService for the frontend

**File**: `angular-frontend/src/app/core/auth/auth.service.ts` (new file)
**Changes**: Angular service that handles login HTTP calls and manages auth state in `localStorage`. Includes a `provider` field in login requests for server-side routing.

```typescript
import { Injectable } from '@angular/core';
import { atom } from 'nanostores';

// Stores the authenticated username (undefined when not logged in).
export const authUsernameStore = atom<string | undefined>(
  localStorage.getItem('authUsername') ?? undefined,
);

// Stores the auth token (undefined when not logged in).
export const authTokenStore = atom<string | undefined>(
  localStorage.getItem('authToken') ?? undefined,
);

(globalThis as any).authUsernameStore = authUsernameStore;
(globalThis as any).authTokenStore = authTokenStore;

/**
 * Manages client-side authentication state and server login requests.
 *
 * Stores auth token and username in localStorage for session persistence
 * across page refreshes. Exposes nanostores atoms so other services can
 * reactively observe auth state. Login requests include a `provider`
 * field so the server can route to the correct auth provider.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /**
   * Sends login credentials to the server for the specified provider.
   * Stores the auth token on success. Returns the result with an optional message.
   */
  async login(
    credentials: Record<string, unknown>,
    provider: string = 'password',
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, provider }),
      });

      const body = await response.json();
      if (!body.ok) {
        return { ok: false, message: body.message ?? 'Login failed' };
      }

      localStorage.setItem('authToken', body.token);
      localStorage.setItem('authUsername', body.username);
      authTokenStore.set(body.token);
      authUsernameStore.set(body.username);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Unable to reach server' };
    }
  }

  /**
   * Validates the stored auth token against the server.
   * Returns true if the token is still valid, false otherwise.
   */
  async validateStoredToken(): Promise<boolean> {
    const token = authTokenStore.get();
    if (!token) {
      return false;
    }

    try {
      const response = await fetch('/auth/validate', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const body = await response.json();
      if (body.ok) {
        authUsernameStore.set(body.username);
        return true;
      }

      // Token invalid — clear stored auth state.
      this.clearAuth();
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Clears all auth state from localStorage and stores.
   */
  clearAuth(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUsername');
    authTokenStore.set(undefined);
    authUsernameStore.set(undefined);
  }
}
```

#### 2.2 Add `login` to SceneNames

**File**: `angular-frontend/src/app/state/game-state.ts`
**Changes**: Add `'login'` to the `SceneNames` type and change the default scene to `'login'`

```typescript
export type SceneNames = 'login' | 'lobby' | 'configuration' | 'match' | 'gameSummary';

// The application starts at the login scene until the user authenticates.
export const sceneStore = atom<SceneNames>('login');
```

#### 2.3 Create LoginComponent

**File**: `angular-frontend/src/app/components/login/login.component.ts` (new file)

```typescript
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { AuthService } from '../../core/auth/auth.service';
import { sceneStore } from '../../state/game-state';

/**
 * Login scene component that gates access to the lobby.
 *
 * Displays a centered username/password form. On successful login,
 * transitions to the lobby scene. Shows an error message on failure.
 * Uses the 'password' auth provider via AuthService.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [SceneContentComponent, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly _authService = inject(AuthService);

  readonly username = signal('');
  readonly password = signal('');
  readonly errorMessage = signal<string | undefined>(undefined);
  readonly isSubmitting = signal(false);

  /**
   * Handles login form submission. Validates credentials via the server
   * and transitions to lobby on success.
   */
  async onSubmit(): Promise<void> {
    this.errorMessage.set(undefined);

    if (!this.username().trim() || !this.password()) {
      this.errorMessage.set('Username/password does not match');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const result = await this._authService.login(
        { username: this.username().trim(), password: this.password() },
        'password',
      );
      if (result.ok) {
        sceneStore.set('lobby');
      } else {
        this.errorMessage.set('Username/password does not match');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
```

**File**: `angular-frontend/src/app/components/login/login.component.html` (new file)

```html
<app-scene-content>
  <div class="login-container">
    <form class="login-form" (ngSubmit)="onSubmit()">
      <label class="login-field">
        <span class="login-label">Username</span>
        <input
          type="text"
          class="login-input"
          [value]="username()"
          (input)="username.set($any($event.target).value)"
          autocomplete="username"
          autofocus
        />
      </label>

      <label class="login-field">
        <span class="login-label">Password</span>
        <input
          type="password"
          class="login-input"
          [value]="password()"
          (input)="password.set($any($event.target).value)"
          autocomplete="current-password"
        />
      </label>

      @if (errorMessage(); as error) {
        <p class="login-error">{{ error }}</p>
      }

      <button
        type="submit"
        class="login-button"
        [disabled]="isSubmitting()"
      >
        Login
      </button>
    </form>
  </div>
</app-scene-content>
```

**File**: `angular-frontend/src/app/components/login/login.component.scss` (new file)

```scss
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(150deg, var(--theme-surface-app-start) 0%, var(--theme-surface-app-end) 100%);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(360px, 90vw);
  padding: 32px;
  border: 1px solid var(--theme-border-subtle);
  border-radius: 12px;
  background: var(--theme-surface-card);
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.login-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

.login-input {
  padding: 10px 12px;
  border: 1px solid var(--theme-border-action);
  border-radius: 6px;
  background: var(--theme-surface-panel);
  color: var(--theme-text-primary);
  font-size: 1rem;
  outline: none;

  &:focus {
    border-color: var(--theme-border-strong);
    box-shadow: 0 0 0 2px rgba(130, 106, 72, 0.2);
  }
}

.login-error {
  margin: 0;
  color: var(--theme-border-danger);
  font-size: 0.875rem;
  font-weight: 500;
}

.login-button {
  border: 1px solid var(--theme-border-action);
  background: var(--theme-action-primary-bg);
  color: var(--theme-text-primary);
  border-radius: 6px;
  padding: 10px 12px;
  font-weight: 600;
  font-size: 1rem;
  margin-top: 4px;
}
```

#### 2.4 Add LoginComponent to AppComponent template and imports

**File**: `angular-frontend/src/app/app.component.ts`
**Changes**: Import `LoginComponent`

```typescript
import { LoginComponent } from './components/login/login.component';

@Component({
  // ...
  imports: [
    // ... existing imports ...
    LoginComponent,
  ],
})
```

**File**: `angular-frontend/src/app/app.component.html`
**Changes**: Add login scene case to the NgSwitch

```html
<ng-container [ngSwitch]="scene()">
  <app-login *ngSwitchCase="'login'"></app-login>
  <app-lobby *ngSwitchCase="'lobby'"></app-lobby>
  <!-- rest stays the same -->
</ng-container>
```

**File**: `angular-frontend/src/app/app.component.scss`
**Changes**: Add `app-login` to the display block rules

```scss
app-login, app-lobby, app-match-configuration, app-match-hud, app-game-summary {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
  max-height: 100%;
}

app-login, app-lobby, app-match-hud, app-game-summary {
  overflow: hidden;
}
```

#### 2.5 Gate socket connection behind auth and auto-validate stored token

**File**: `angular-frontend/src/main.ts`
**Changes**: Check for stored auth token on startup. If valid, go to lobby and connect socket. If not, stay on login scene. After login succeeds, connect socket.

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { SocketService } from './app/core/socket-service/socket.service';
import { socketToGameEventMap } from './app/core/socket-service/socket-event-map';
import { AuthService, authTokenStore } from './app/core/auth/auth.service';
import { sceneStore } from './app/state/game-state';

bootstrapApplication(AppComponent, appConfig)
  .then(async appRef => {
    const injector = appRef.injector;
    const authService = injector.get(AuthService);
    const socketService = injector.get(SocketService);

    // Try to restore a previous auth session.
    const hasValidToken = await authService.validateStoredToken();
    if (hasValidToken) {
      // Skip login, go straight to lobby and connect socket.
      sceneStore.set('lobby');
      socketService.setEventMap(socketToGameEventMap());
      socketService.emit('requestSelectableSearchCatalog');
    }

    // Subscribe to auth token changes so socket connects after login.
    authTokenStore.subscribe(token => {
      if (token && !socketService.isConnected()) {
        socketService.setEventMap(socketToGameEventMap());
        socketService.emit('requestSelectableSearchCatalog');
      }
    });
  })
  .catch((err) => console.error(err));
```

#### 2.6 Add isConnected() to SocketService

**File**: `angular-frontend/src/app/core/socket-service/socket.service.ts`
**Changes**: Add a method to check if the socket is connected — add after the `emit` method.

```typescript
/**
 * Returns true if the socket is currently connected to the server.
 */
public isConnected(): boolean {
  return this._socket.connected;
}
```

#### 2.7 Add logout() to AuthService

**File**: `angular-frontend/src/app/core/auth/auth.service.ts` (already created in 2.1)
**Changes**: Add a `logout()` method after `clearAuth()`. The method calls `DELETE /auth/logout` with the current token, then clears local auth state regardless of the response (idempotent).

```typescript
/**
 * Logs out by invalidating the server-side session and clearing local auth state.
 * The server call is best-effort — local state is always cleared.
 */
async logout(): Promise<void> {
  const token = authTokenStore.get();
  if (token) {
    try {
      await fetch('/auth/logout', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch {
      // Ignore network errors — clear local state regardless.
    }
  }
  this.clearAuth();
}
```

#### 2.8 Add disconnect() to SocketService

**File**: `angular-frontend/src/app/core/socket-service/socket.service.ts` (already created in 2.6)
**Changes**: Add a `disconnect()` method after `isConnected()` so logout can cleanly tear down the socket connection.

```typescript
/**
 * Disconnects the socket from the server.
 */
public disconnect(): void {
  this._socket.disconnect();
}
```

#### 2.9 Add logout button to the lobby banner

**File**: `angular-frontend/src/app/components/lobby/lobby.component.html`
**Changes**: Project a "Logout" button into the banner's `[sceneHeaderActions]` slot. The lobby already uses `<app-scene-content>` which accepts this projection.

```html
<app-scene-content>
  <button sceneHeaderActions type="button" class="logout-button" (click)="logout()">
    Logout
  </button>

  <section class="lobby-shell">
    <!-- existing lobby content unchanged -->
  </section>
</app-scene-content>
```

**File**: `angular-frontend/src/app/components/lobby/lobby.component.ts`
**Changes**: Inject `AuthService` and `SocketService`, add a `logout()` method.

```typescript
import { AuthService } from '../../core/auth/auth.service';
import { SocketService } from '../../core/socket-service/socket.service';
import { sceneStore } from '../../state/game-state';

// In the component class, inject the services and add logout():

private readonly _authService = inject(AuthService);
private readonly _socketService = inject(SocketService);

/**
 * Logs out the current user: invalidates the server session, disconnects
 * the socket, clears local auth state, and returns to the login scene.
 */
async logout(): Promise<void> {
  await this._authService.logout();
  this._socketService.disconnect();
  sceneStore.set('login');
}
```

**File**: `angular-frontend/src/app/components/lobby/lobby.component.scss`
**Changes**: Add minimal styles for the logout button so it fits the banner's action area.

```scss
.logout-button {
  border: 1px solid var(--theme-border-action);
  background: transparent;
  color: var(--theme-text-primary);
  border-radius: 6px;
  padding: 6px 14px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Frontend type-checks: `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit`

#### Manual Verification:
- [ ] Opening the app shows the login screen with the banner header
- [ ] Login form is centered with username on top, password on bottom
- [ ] Entering wrong password shows red "Username/password does not match" error text
- [ ] Entering correct password transitions to the lobby scene
- [ ] Refreshing the page after login goes directly to the lobby (token persisted)
- [ ] "Logout" button appears in the lobby banner and returns to the login screen when clicked

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Socket Auth Integration

### Overview
Pass the auth token in the socket.io handshake query so the server can validate authenticated sessions. Update the server socket gateway to validate the auth token using `AuthSessionService` (provider-agnostic — works with any auth method).

### Changes Required:

#### 3.1 Include auth token in socket handshake

**File**: `angular-frontend/src/app/core/socket-service/socket.service.ts`
**Changes**: Read the auth token from `localStorage` and include it in the socket.io handshake query alongside `sessionId`.

```typescript
// In the constructor, update the socket creation:
const authToken = localStorage.getItem('authToken');

this._socket = io(environment.wsHost, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  autoConnect: false,
  timeout: environment.wsTimeout,
  requestTimeout: environment.wsRequestTimeout,
  query: {
    sessionId,
    ...(authToken ? { authToken } : {}),
  },
}) as unknown as Socket<ServerListenEvents, ServerEmitEvents>;
```

#### 3.2 Validate auth token on socket connection

**File**: `server/src/core/server-socket-gateway-service.ts`
**Changes**: Inject `AuthSessionService` and validate the auth token from the handshake query. Session validation is provider-agnostic — it only checks the token store.

```typescript
import { AuthSessionService } from './auth/auth-session-service.ts';

export class ServerSocketGatewayService {
  private registered = false;

  constructor(
    private readonly io: Server<ServerListenEvents, ServerEmitEvents>,
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly loggerService: LoggerService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  public registerConnectionHandler(): void {
    if (this.registered) {
      this.loggerService.warn('[server socket gateway] connection handler already registered; skipping');
      return;
    }

    this.registered = true;
    this.io.on('connection', socket => {
      this.loggerService.log('[SERVER] new client connected');

      const sessionId = socket.handshake.query.get('sessionId');
      const authToken = socket.handshake.query.get('authToken');
      this.loggerService.info(`[SERVER] connection from ${socket.handshake.address} - session ID ${sessionId}`);

      if (!sessionId) {
        this.loggerService.error('[SERVER] no session ID, rejecting');
        socket.disconnect();
        return;
      }

      if (!authToken) {
        this.loggerService.error('[SERVER] no auth token, rejecting');
        socket.disconnect();
        return;
      }

      const username = this.authSessionService.validateToken(authToken);
      if (!username) {
        this.loggerService.error(`[SERVER] invalid auth token for session ${sessionId}, rejecting`);
        socket.disconnect();
        return;
      }

      this.loggerService.info(`[SERVER] authenticated user '${username}' for session ${sessionId}`);
      this.lobbyDirectoryService.registerConnection(sessionId, socket);
    });
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Server type-checks: `cd server && deno check --no-lock src/server.ts`
- [ ] Server lints: `cd server && deno lint src/`
- [ ] Frontend type-checks: `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit`

#### Manual Verification:
- [ ] Full flow: login → lobby → create game → play. Socket connects successfully with auth token.
- [ ] Clearing localStorage and refreshing shows the login screen again.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.
