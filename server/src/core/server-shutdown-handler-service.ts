import { LobbyDirectoryService } from './lobby-directory-service.ts';
import { LoggerService } from './logger-service.ts';
import { AuthSessionCleanupService } from './auth/auth-session-cleanup-service.ts';
import { AuthKvProvider } from './auth/auth-kv-provider.ts';

/**
 * Owns process shutdown signal handling for graceful server teardown.
 *
 * Stops the auth session cleanup timer and closes the shared auth KV handle
 * on shutdown so no stray callbacks fire and the KV file is released cleanly.
 * All auth stores share the KV handle (see AuthKvProvider).
 */
export class ServerShutdownHandlerService {
  // Tracks registration state to prevent duplicate listeners.
  private registered = false;

  constructor(
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly loggerService: LoggerService,
    private readonly authSessionCleanupService: AuthSessionCleanupService,
    private readonly authKvProvider: AuthKvProvider,
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
      // Close the shared auth KV handle so the database file is released.
      // Stores with their own `kv` reference will see undefined on any
      // pending fire-and-forget writes; errors are logged.
      this.authKvProvider.close();
      this.lobbyDirectoryService.dispose();
      shutdownController.abort();
      Deno.exit();
    });
  }
}
