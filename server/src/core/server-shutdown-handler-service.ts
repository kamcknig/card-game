import { LobbyDirectoryService } from './lobby-directory-service.ts';
import { LoggerService } from './logger-service.ts';
import { AuthSessionCleanupService } from './auth/auth-session-cleanup-service.ts';

/**
 * Owns process shutdown signal handling for graceful server teardown.
 *
 * Phase 2: stops the auth session cleanup timer on shutdown so no stray
 * interval callbacks fire after the process begins winding down.
 */
export class ServerShutdownHandlerService {
  // Tracks registration state to prevent duplicate listeners.
  private registered = false;

  constructor(
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly loggerService: LoggerService,
    private readonly authSessionCleanupService: AuthSessionCleanupService,
  ) {}

  // Registers SIGINT behavior to dispose runtime resources and stop serving.
  public registerShutdownHandler(shutdownController: AbortController): void {
    if (this.registered) {
      this.loggerService.warn('[server shutdown handler] shutdown handler already registered; skipping');
      return;
    }

    this.registered = true;
    addEventListener('SIGINT', () => {
      this.loggerService.log('Shutting down cleanly...');
      this.authSessionCleanupService.stop();
      this.lobbyDirectoryService.dispose();
      shutdownController.abort();
      Deno.exit();
    });
  }
}
