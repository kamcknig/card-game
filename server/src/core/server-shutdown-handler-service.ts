import { LobbyDirectoryService } from './lobby-directory-service.ts';
import { LoggerService } from './logger-service.ts';
import { AuthSessionCleanupService } from './auth/auth-session-cleanup-service.ts';
import { AuthKvProvider } from './auth/auth-kv-provider.ts';
import { GameDataKvProvider } from './game-data-kv-provider.ts';

/**
 * Owns process shutdown signal handling for graceful server teardown.
 *
 * Stops the auth session cleanup timer and closes both the shared auth KV
 * handle and the shared game-data KV handle on shutdown so no stray callbacks
 * fire and both KV files are released cleanly. All auth stores share the auth
 * KV handle (see AuthKvProvider); all game-data stores share the game-data KV
 * handle (see GameDataKvProvider).
 */
export class ServerShutdownHandlerService {
  // Tracks registration state to prevent duplicate listeners.
  private registered = false;

  constructor(
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly loggerService: LoggerService,
    private readonly authSessionCleanupService: AuthSessionCleanupService,
    private readonly authKvProvider: AuthKvProvider,
    private readonly gameDataKvProvider: GameDataKvProvider,
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
      // Close the shared game-data KV handle so the database file is released.
      // DenoKvMatchConfigurationSaveService holds a reference to the same handle;
      // pending fire-and-forget writes may fail after this point and their errors
      // are logged by the individual store methods.
      this.gameDataKvProvider.close();
      this.lobbyDirectoryService.dispose();
      shutdownController.abort();
      Deno.exit();
    });
  }
}
