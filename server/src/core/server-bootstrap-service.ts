import { ServerStartupService } from './server-startup-service.ts';
import { ServerConfigService } from './server-config-service.ts';
import { LoggerService } from './logger-service.ts';
import { ServerSocketGatewayService } from './server-socket-gateway-service.ts';
import { ServerDebugRouteHandlerService } from './server-debug-route-handler-service.ts';
import { ServerShutdownHandlerService } from './server-shutdown-handler-service.ts';

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
      handler: (req, info) => this.serverDebugRouteHandlerService.handleRequest(req, info),
    });

    void this.serverStartupService.start().catch(error => {
      // Surface startup failures and stop the process so the host can restart.
      this.loggerService.error('[SERVER] startup failed');
      this.loggerService.error(error);
      Deno.exit(1);
    });
  }
}
