import { Server } from 'socket.io';
import { ServerEmitEvents, ServerListenEvents } from 'shared/types/index.ts';
import { LobbyDirectoryService } from './lobby-directory-service.ts';
import { LoggerService } from './logger-service.ts';
import { AuthSessionService } from './auth/auth-session-service.ts';

/**
 * Owns socket connection handling for inbound client sessions.
 *
 * This class isolates transport-level connection logic from bootstrap
 * orchestration so connection behavior can evolve independently.
 *
 * Validates the auth token from the socket handshake query using
 * `AuthSessionService` before registering the connection. Authentication
 * is provider-agnostic — only the session token is checked here.
 */
export class ServerSocketGatewayService {
  // Tracks whether the connection handler has already been registered.
  private registered = false;

  constructor(
    private readonly io: Server<ServerListenEvents, ServerEmitEvents>,
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly loggerService: LoggerService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  // Registers the socket connection handler exactly once.
  public registerConnectionHandler(): void {
    if (this.registered) {
      this.loggerService.warn('[server socket gateway] connection handler already registered; skipping');
      return;
    }

    this.registered = true;
    this.io.on('connection', socket => {
      this.loggerService.log('[SERVER] new client connected');

      const sessionId = socket.handshake.query.get('sessionId');
      // Auth token is sent via socket.io auth (callback form) so it is read
      // from localStorage at connection time rather than at socket construction.
      const authToken = socket.handshake.auth['authToken'] as string | undefined;
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

      // Validate the auth token against the session store. The check is
      // provider-agnostic — any provider that created the token is accepted.
      const username = this.authSessionService.validateToken(authToken);
      if (!username) {
        this.loggerService.error(`[SERVER] invalid auth token for session ${sessionId}, rejecting`);
        socket.disconnect();
        return;
      }

      this.loggerService.info(`[SERVER] authenticated user '${username}' for session ${sessionId}`);
      // Pass the validated username so it is used as the player's display name.
      this.lobbyDirectoryService.registerConnection(sessionId, socket, username);
    });
  }
}
