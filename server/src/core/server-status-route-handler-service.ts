import { ServerHealthService } from './server-health-service.ts';
import { ServerConfigService } from './server-config-service.ts';
import { buildCorsHeaders } from './cors-utils.ts';

/**
 * Handles HTTP requests to the /status endpoint.
 *
 * Returns a 200 response with the current {@link ServerStatusSnapshot} JSON
 * regardless of the health state — the body conveys severity, not the HTTP
 * status code. CORS preflight OPTIONS requests are handled so browsers on
 * different origins (e.g., the Angular dev server) can poll the endpoint.
 *
 * Routes handled:
 *   GET  /status — returns the current health snapshot as JSON.
 *   OPTIONS /status — CORS preflight response.
 *
 * Lifetime: Root singleton.
 * Consumers: ServerBootstrapService — checked before all other route handlers.
 */
export class ServerStatusRouteHandlerService {
  constructor(
    private readonly serverHealthService: ServerHealthService,
    private readonly serverConfigService: ServerConfigService,
  ) {}

  /**
   * Returns true when this handler should process the given request.
   *
   * Matches GET and OPTIONS requests whose pathname is exactly `/status`.
   */
  public canHandle(req: Request): boolean {
    const url = new URL(req.url);
    return url.pathname === '/status' && (req.method === 'GET' || req.method === 'OPTIONS');
  }

  /**
   * Handles the /status request.
   *
   * OPTIONS → 204 preflight with CORS headers.
   * GET     → 200 with the current {@link ServerStatusSnapshot} JSON and CORS headers.
   *
   * The HTTP status is always 200/204 regardless of the health snapshot's
   * `status` field so load balancers and monitoring probes do not alert on
   * application-level degradation; the body carries the severity.
   */
  public handleRequest(req: Request): Response {
    const corsHeaders = buildCorsHeaders(
      this.serverConfigService.getAuthAllowedOrigins(),
      req,
      'GET, OPTIONS',
    );

    // Respond to CORS preflight without touching the health state.
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const snapshot = this.serverHealthService.snapshot();
    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }
}
