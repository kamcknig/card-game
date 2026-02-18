import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import { Game } from './game.ts';
import { LoggerService } from './logger-service.ts';

/**
 * Owns socket connection handling for inbound client sessions.
 *
 * This class isolates transport-level connection logic from bootstrap
 * orchestration so connection behavior can evolve independently.
 */
export class ServerSocketGatewayService {
  // Tracks whether the connection handler has already been registered.
  private registered = false;

  constructor(
    private readonly io: Server<ServerListenEvents, ServerEmitEvents>,
    private readonly game: Game,
    private readonly loggerService: LoggerService,
  ) {
  }

  // Registers the socket connection handler exactly once.
  public registerConnectionHandler(): void {
    if (this.registered) {
      this.loggerService.warn('[server socket gateway] connection handler already registered; skipping');
      return;
    }

    this.registered = true;
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
}
