import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { AuthSessionService } from './auth-session-service.ts';
import { AuthRateLimiterService } from './auth-rate-limiter-service.ts';

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
 * Hardening applied in Phase 1:
 * - Body size cap enforced before parsing (AUTH_MAX_BODY_BYTES).
 * - Per-IP sliding-window rate limiting on failed logins (AuthRateLimiterService).
 * - CORS uses an allowlist instead of blindly reflecting the request origin.
 * - Remote IP is passed in from the caller (derived in ServerBootstrapService).
 *
 * Lifetime: Root singleton — called from ServerBootstrapService HTTP handler.
 * Consumers: ServerBootstrapService.
 */
export class ServerAuthRouteHandlerService {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly loggerService: LoggerService,
    private readonly serverConfigService: ServerConfigService,
    private readonly authRateLimiterService: AuthRateLimiterService,
  ) {}

  /**
   * Routes /auth/* HTTP requests to the appropriate handler.
   *
   * Returns undefined when the path does not start with /auth, allowing
   * the caller to fall through to the next handler. Handles CORS preflight
   * OPTIONS requests so browsers can call auth endpoints cross-origin
   * (required when the Angular frontend is served from a different origin
   * than the game server, e.g., separate Azure Container Apps).
   *
   * @param req The incoming HTTP request.
   * @param url The pre-parsed URL for the request.
   * @param remoteIp The client IP, used for rate limiting. Derived by the
   *   caller from the socket remote address or X-Forwarded-For header.
   */
  public handleRequest(req: Request, url: URL, remoteIp: string): Response | Promise<Response> | undefined {
    if (!url.pathname.startsWith('/auth')) {
      return undefined;
    }

    // Respond to CORS preflight before routing to specific handlers.
    if (req.method === 'OPTIONS') {
      this.loggerService.debug(`[auth route] CORS preflight: ${url.pathname}`);
      return new Response(null, { status: 204, headers: this.corsHeaders(req) });
    }

    const parts = url.pathname.split('/').filter(Boolean);

    // POST /auth/login
    if (parts.length === 2 && parts[1] === 'login' && req.method === 'POST') {
      return this.handleLogin(req, remoteIp);
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
    return new Response('auth resource not found', { status: 404, headers: this.corsHeaders(req) });
  }

  /**
   * Validates credentials via the specified provider and returns an auth token on success.
   *
   * Enforces the body-size cap before parsing JSON. Applies IP-based rate
   * limiting: rejects with 429 when the IP has exceeded its failure budget,
   * and records each failure (bad JSON, wrong password, unknown provider)
   * toward the limit. Resets the counter on successful login.
   *
   * Reads the `provider` field from the request body to select the auth
   * method. Defaults to 'password' when provider is not specified.
   * Returns 401 on authentication failure and 400 on malformed request bodies.
   */
  private async handleLogin(req: Request, remoteIp: string): Promise<Response> {
    // Check rate limit before doing any work.
    if (this.authRateLimiterService.isLimited(remoteIp)) {
      const retryAfterSec = Math.ceil(this.authRateLimiterService.retryAfterMs(remoteIp) / 1000);
      this.loggerService.warn(`[auth route] rate-limited login attempt from ${remoteIp}`);
      return this.jsonResponse({ ok: false, message: 'Too many attempts' }, 429, req, {
        'retry-after': String(retryAfterSec),
      });
    }

    // Guard body size before calling req.json() to avoid parsing large bodies.
    const contentLength = Number(req.headers.get('content-length') ?? '0');
    const maxBytes = this.serverConfigService.getAuthMaxBodyBytes();
    if (contentLength > maxBytes) {
      this.loggerService.warn(`[auth route] login body too large from ${remoteIp}: ${contentLength} > ${maxBytes}`);
      return new Response('payload too large', { status: 413, headers: this.corsHeaders(req) });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      this.loggerService.debug(`[auth route] login request body is not valid JSON from ${remoteIp}`);
      this.authRateLimiterService.recordFailure(remoteIp);
      return new Response('invalid json', { status: 400, headers: this.corsHeaders(req) });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      this.loggerService.debug(`[auth route] login request body is not a plain object from ${remoteIp}`);
      this.authRateLimiterService.recordFailure(remoteIp);
      return this.jsonResponse({ ok: false, message: 'invalid request body' }, 400, req);
    }

    // Default to 'password' provider for backwards compatibility.
    const providerName = typeof body['provider'] === 'string' ? body['provider'] : 'password';
    this.loggerService.debug(`[auth route] login attempt via provider '${providerName}' from ${remoteIp}`);

    const result = await this.authSessionService.login(providerName, body);
    if (!result.ok) {
      this.authRateLimiterService.recordFailure(remoteIp);
      this.loggerService.warn(
        `[auth route] login failed from ${remoteIp} via '${providerName}' (${result.message})`,
      );
      return this.jsonResponse(result, 401, req);
    }

    // Reset the rate-limiter counter on successful login.
    this.authRateLimiterService.reset(remoteIp);
    this.loggerService.info(
      `[auth route] login succeeded from ${remoteIp} for '${result.username}' via '${providerName}'`,
    );
    return this.jsonResponse({ ok: true, token: result.token, username: result.username }, 200, req);
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
      return this.jsonResponse({ ok: false, message: 'missing authorization header' }, 401, req);
    }

    const username = this.authSessionService.validateToken(token);
    if (!username) {
      this.loggerService.debug('[auth route] validate request has invalid or expired token');
      return this.jsonResponse({ ok: false, message: 'invalid or expired token' }, 401, req);
    }

    this.loggerService.debug(`[auth route] token validated for '${username}'`);
    return this.jsonResponse({ ok: true, username }, 200, req);
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
    return this.jsonResponse({ ok: true }, 200, req);
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
   * Creates a consistent JSON HTTP response with appropriate content-type,
   * CORS headers, and any additional headers provided.
   */
  private jsonResponse(
    payload: unknown,
    status: number = 200,
    req?: Request,
    extraHeaders?: Record<string, string>,
  ): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json', ...this.corsHeaders(req), ...extraHeaders },
    });
  }

  /**
   * Builds CORS headers based on the configured origin allowlist.
   *
   * When the allowlist contains `*`, falls back to wildcard behavior (dev
   * mode). Otherwise, echoes the request origin only if it appears in the
   * allowlist; requests from unlisted origins receive no allow-origin header
   * so browsers will refuse the response. The `Vary: Origin` header prevents
   * caches from serving the wrong allow-origin to a different origin.
   */
  private corsHeaders(req?: Request): Record<string, string> {
    const allowed = this.serverConfigService.getAuthAllowedOrigins();
    const requestOrigin = req?.headers.get('origin') ?? '';

    // When the allowlist is exactly ['*'], fall back to wildcard behavior.
    const originHeader = allowed.includes('*')
      ? '*'
      : allowed.includes(requestOrigin)
        ? requestOrigin
        : '';

    const headers: Record<string, string> = {
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-max-age': '86400',
      'vary': 'Origin',
    };

    // Only include the allow-origin header when the origin is permitted.
    if (originHeader) {
      headers['access-control-allow-origin'] = originHeader;
    }

    return headers;
  }
}
