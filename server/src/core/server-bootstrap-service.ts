import { ServerStartupService } from './server-startup-service.ts';
import { ServerConfigService } from './server-config-service.ts';
import { LoggerService } from './logger-service.ts';
import { ServerSocketGatewayService } from './server-socket-gateway-service.ts';
import { ServerDebugRouteHandlerService } from './server-debug-route-handler-service.ts';
import { ServerShutdownHandlerService } from './server-shutdown-handler-service.ts';
import { ServerAuthRouteHandlerService } from './auth/server-auth-route-handler-service.ts';
import { ServerStatusRouteHandlerService } from './server-status-route-handler-service.ts';

/**
 * Orchestrates host startup by delegating transport, routes, and shutdown
 * responsibilities to dedicated services.
 */
export class ServerBootstrapService {
  private started = false;
  private readonly shutdownController = new AbortController();

  constructor(
    private readonly serverStartupService: ServerStartupService,
    private readonly serverConfigService: ServerConfigService,
    private readonly loggerService: LoggerService,
    private readonly serverSocketGatewayService: ServerSocketGatewayService,
    private readonly serverDebugRouteHandlerService: ServerDebugRouteHandlerService,
    private readonly serverShutdownHandlerService: ServerShutdownHandlerService,
    private readonly serverAuthRouteHandlerService: ServerAuthRouteHandlerService,
    private readonly serverStatusRouteHandlerService: ServerStatusRouteHandlerService,
  ) {}

  // Starts socket handling, shutdown wiring, HTTP serving, and expansion startup loading.
  public start(): void {
    if (this.started) {
      this.loggerService.warn('[server bootstrap] start called more than once; ignoring');
      return;
    }
    this.started = true;

    try {
      // Validate all startup environment inputs before binding listeners.
      this.serverConfigService.validate();
    } catch (error) {
      this.loggerService.error('[SERVER] invalid startup configuration');
      this.loggerService.error(error);
      Deno.exit(1);
    }

    this.serverSocketGatewayService.registerConnectionHandler();
    this.serverShutdownHandlerService.registerShutdownHandler(this.shutdownController);

    Deno.serve({
      port: this.serverConfigService.getPort(),
      signal: this.shutdownController.signal,
      handler: (req, info) => {
        const url = new URL(req.url);
        // Derive the client IP for rate limiting before routing.
        const remoteIp = this.extractRemoteIp(req, info);
        // Status route is checked first so health can be queried even when
        // the storage backend has failed to open.
        if (this.serverStatusRouteHandlerService.canHandle(req)) {
          return this.serverStatusRouteHandlerService.handleRequest(req);
        }
        // Auth routes take priority over debug and socket.io.
        const authResponse = this.serverAuthRouteHandlerService.handleRequest(req, url, remoteIp);
        if (authResponse) {
          return authResponse;
        }
        return this.serverDebugRouteHandlerService.handleRequest(req, info);
      },
    });

    void this.serverStartupService.start().catch(error => {
      // Surface startup failures and stop the process so the host can restart.
      this.loggerService.error('[SERVER] startup failed');
      this.loggerService.error(error);
      Deno.exit(1);
    });
  }

  /**
   * Extracts the client IP address for rate limiting.
   *
   * Prefers the leftmost entry in the X-Forwarded-For header when present,
   * since Azure Container Apps (our ingress) sets it for us. Falls back to
   * the TCP socket's remote hostname. Only the first hop is trusted — we do
   * not attempt to parse multiple hops from the forwarded chain.
   *
   * Returns 'unknown' when the remote address is a Unix socket or the
   * X-Forwarded-For header is absent and the addr has no hostname.
   */
  private extractRemoteIp(req: Request, info: Deno.ServeHandlerInfo): string {
    const fwd = req.headers.get('x-forwarded-for');
    const socketHostname = info.remoteAddr.transport === 'tcp' || info.remoteAddr.transport === 'udp'
      ? info.remoteAddr.hostname
      : 'unknown';

    if (fwd) {
      return fwd.split(',')[0]?.trim() || socketHostname;
    }
    return socketHostname;
  }
}
