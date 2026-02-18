import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import { Game } from './game.ts';
import { ServerStartupService } from './server-startup-service.ts';
import { ServerConfigService } from './server-config-service.ts';
import { LoggerService } from './logger-service.ts';

// Owns runtime host wiring so server.ts can remain a pure composition root.
export class ServerBootstrapService {
  private started = false;
  private readonly shutdownController = new AbortController();
  private readonly ioHandler: ReturnType<Server<ServerListenEvents, ServerEmitEvents>['handler']>;

  constructor(
    private readonly io: Server<ServerListenEvents, ServerEmitEvents>,
    private readonly game: Game,
    private readonly serverStartupService: ServerStartupService,
    private readonly serverConfigService: ServerConfigService,
    private readonly loggerService: LoggerService,
  ) {
    this.ioHandler = this.io.handler();
  }

  // Starts socket, HTTP debug routes, and expansion startup loading.
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

    this.registerSocketHandlers();
    this.registerShutdownHandler();

    const port = this.serverConfigService.getPort();
    Deno.serve({
      port,
      signal: this.shutdownController.signal,
      handler: (req, info) => this.handleRequest(req, info),
    });

    void this.serverStartupService.start().catch((error) => {
      // Surface startup failures and stop the process so the host can restart.
      this.loggerService.error('[SERVER] startup failed');
      this.loggerService.error(error);
      Deno.exit(1);
    });
  }

  // Registers the socket connection handler for new clients.
  private registerSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      this.loggerService.log('[SERVER] new client connected');

      const sessionId = socket.handshake.query.get('sessionId');
      this.loggerService.info(
        `[SERVER] connection from ${socket.handshake.address} - session ID ${sessionId}`,
      );

      if (!sessionId) {
        this.loggerService.error('[SERVER] no session ID, rejecting');
        socket.disconnect();
        return;
      }

      this.game.addPlayer(sessionId, socket);
    });
  }

  // Handles HTTP routes and delegates unmatched requests to socket.io.
  private handleRequest(req: Request, info: Deno.ServeHandlerInfo): Response | Promise<Response> {
    const url = new URL(req.url);

    // Debug-only endpoint to export a full match state snapshot.
    if (url.pathname === '/debug/match-state') {
      if (!this.serverConfigService.isMatchStateExportEnabled()) {
        return new Response('match state export disabled', { status: 403 });
      }
      const exportState = this.game.exportMatchState();
      if (!exportState) {
        return new Response('match not initialized', { status: 400 });
      }
      return new Response(JSON.stringify(exportState), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // Debug-only endpoint to merge a partial match state into the live match.
    if (url.pathname === '/debug/match-state/merge') {
      if (!this.serverConfigService.isMatchStateMergeEnabled()) {
        return new Response('match state merge disabled', { status: 403 });
      }
      if (req.method !== 'POST') {
        return new Response('method not allowed', { status: 405 });
      }
      return req.json()
        .then((body) => {
          // Require a JSON object as the partial match payload.
          if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return new Response('invalid match payload', { status: 400 });
          }

          const result = this.game.mergeMatchState(body);
          if (!result.ok) {
            return new Response(JSON.stringify({ error: 'invalid match update', errors: result.errors }), {
              status: 400,
              headers: { 'content-type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'content-type': 'application/json' },
          });
        })
        .catch(() => {
          return new Response('invalid json', { status: 400 });
        });
    }

    return this.ioHandler(req, info);
  }

  // Handles CTRL+C so runtime resources are disposed before exiting.
  private registerShutdownHandler(): void {
    addEventListener('SIGINT', () => {
      this.loggerService.log('Shutting down cleanly...');
      this.game.dispose();
      this.shutdownController.abort();
      Deno.exit();
    });
  }
}
