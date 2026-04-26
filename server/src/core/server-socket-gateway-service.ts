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
 *
 * Enforces the one-user one-tab policy at the socket layer: when a new
 * socket authenticates as username U, any prior socket bound to U is sent
 * the `sessionTakenOver` event and forcibly disconnected. Tracked via the
 * per-username socket-id map below; the disconnect listener cleans the
 * entry up so a normal close (refresh, network drop) does not leave a
 * stale binding behind.
 */
export class ServerSocketGatewayService {
  // Tracks whether the connection handler has already been registered.
  private registered = false;

  // Active socket id per username. Single-tab enforcement keeps this 1:1;
  // a fresh connection kicks the prior entry before recording the new id.
  private readonly socketIdByUsername = new Map<string, string>();

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

      // Enforce one-user one-tab: kick any prior socket for the same
      // username before recording this socket as the active one. The
      // kicked client receives `sessionTakenOver` so it can clear local
      // auth state and redirect to /login rather than going zombie.
      this.kickPriorSocketForUsername(username, socket.id);
      this.socketIdByUsername.set(username, socket.id);
      socket.on('disconnect', () => {
        // Only drop the binding if this socket is still the recorded one.
        // A normal close after a takeover-kick must not erase the new
        // socket's entry — that would leak a stale username binding.
        if (this.socketIdByUsername.get(username) === socket.id) {
          this.socketIdByUsername.delete(username);
        }
      });

      // Pass the validated username so it is used as the player's display name.
      this.lobbyDirectoryService.registerConnection(sessionId, socket, username);
    });
  }

  /**
   * Forcibly disconnects any prior socket for the given username so the
   * newly authenticated socket becomes the sole connection for that user.
   *
   * Emits `sessionTakenOver` first so the client can perform a clean
   * frontend logout (clear localStorage, navigate to /login) instead of
   * relying on the generic disconnect signal. Skips when no prior socket
   * exists or the recorded id matches the incoming socket (no-op for the
   * first connection / reconnect of the same socket).
   */
  private kickPriorSocketForUsername(username: string, incomingSocketId: string): void {
    const priorId = this.socketIdByUsername.get(username);
    if (!priorId || priorId === incomingSocketId) {
      return;
    }
    // Reach into the default ('/') namespace's connected-sockets map.
    // The typed `Server` exposes only emit-style helpers; per-id lookup
    // lives on the namespace.
    const priorSocket = this.io.of('/').sockets.get(priorId);
    if (!priorSocket) {
      // The recorded id is stale (the socket already closed). Drop the
      // binding so the new connection cleanly takes over without trying
      // to emit to a dead socket.
      this.socketIdByUsername.delete(username);
      return;
    }
    this.loggerService.info(
      `[SERVER] kicking prior socket ${priorId} for '${username}' — session taken over by ${incomingSocketId}`,
    );
    priorSocket.emit('sessionTakenOver');
    priorSocket.disconnect(true);
  }
}
