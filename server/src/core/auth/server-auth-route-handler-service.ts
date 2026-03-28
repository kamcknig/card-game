import { LoggerService } from '../logger-service.ts';
import { AuthSessionService } from './auth-session-service.ts';

/**
 * Handles HTTP authentication endpoints for login, token validation, and logout.
 *
 * Routes:
 *   POST   /auth/login    — validates credentials via the selected provider
 *   GET    /auth/validate — validates an existing session token
 *   DELETE /auth/logout   — invalidates the current session token
 *
 * Login requests accept an optional `provider` field to select the
 * authentication method. Defaults to 'password' for backwards compatibility.
 * Token validation is provider-agnostic — it only checks the session store.
 *
 * Lifetime: Root singleton — called from ServerBootstrapService HTTP handler.
 * Consumers: ServerBootstrapService.
 */
export class ServerAuthRouteHandlerService {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Routes /auth/* HTTP requests to the appropriate handler.
   *
   * Returns undefined when the path does not start with /auth, allowing
   * the caller to fall through to the next handler.
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

    // DELETE /auth/logout
    if (parts.length === 2 && parts[1] === 'logout' && req.method === 'DELETE') {
      return this.handleLogout(req);
    }

    this.loggerService.debug(`[auth route] unmatched auth path: ${req.method} ${url.pathname}`);
    return new Response('auth resource not found', { status: 404 });
  }

  /**
   * Validates credentials via the specified provider and returns an auth token on success.
   *
   * Reads the `provider` field from the request body to select the auth method.
   * Defaults to 'password' when provider is not specified. Returns 401 on
   * authentication failure and 400 on malformed request bodies.
   */
  private async handleLogin(req: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      this.loggerService.debug('[auth route] login request body is not valid JSON');
      return new Response('invalid json', { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      this.loggerService.debug('[auth route] login request body is not a plain object');
      return this.jsonResponse({ ok: false, message: 'invalid request body' }, 400);
    }

    // Default to 'password' provider for backwards compatibility.
    const providerName = typeof body['provider'] === 'string' ? body['provider'] : 'password';
    this.loggerService.debug(`[auth route] login attempt via provider '${providerName}'`);

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

  /**
   * Validates an existing auth token from the Authorization Bearer header.
   *
   * Returns 401 when the header is missing or the token is not a known session.
   */
  private handleValidate(req: Request): Response {
    const token = this.extractBearerToken(req);
    if (!token) {
      this.loggerService.debug('[auth route] validate request missing authorization header');
      return this.jsonResponse({ ok: false, message: 'missing authorization header' }, 401);
    }

    const username = this.authSessionService.validateToken(token);
    if (!username) {
      this.loggerService.debug('[auth route] validate request has invalid or expired token');
      return this.jsonResponse({ ok: false, message: 'invalid or expired token' }, 401);
    }

    this.loggerService.debug(`[auth route] token validated for '${username}'`);
    return this.jsonResponse({ ok: true, username });
  }

  /**
   * Invalidates the auth session identified by the Bearer token.
   *
   * Returns 200 even when the token was not found so the endpoint is idempotent.
   * The client should discard the token regardless of outcome.
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

  /**
   * Extracts a Bearer token from the Authorization header.
   *
   * Returns undefined when the header is absent or not a Bearer scheme.
   */
  private extractBearerToken(req: Request): string | undefined {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return undefined;
    }
    return authHeader.slice(7).trim() || undefined;
  }

  /**
   * Creates a consistent JSON HTTP response with appropriate content-type header.
   */
  private jsonResponse(payload: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }
}
