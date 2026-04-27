import { LobbyDirectoryService } from './lobby-directory-service.ts';
import { LoggerService } from './logger-service.ts';
import { AuthSessionCleanupService } from './auth/auth-session-cleanup-service.ts';
import { SupabaseClientProvider } from './storage/supabase-client-provider.ts';

/**
 * Owns process shutdown signal handling for graceful server teardown.
 *
 * Stops the auth session cleanup timer and closes the Supabase client on
 * shutdown so no stray callbacks fire and all handles are released cleanly.
 * The Supabase client close is a no-op (supabase-js exposes no disconnect
 * method) but exists for symmetry. In-memory stores require no cleanup.
 */
export class ServerShutdownHandlerService {
  // Tracks registration state to prevent duplicate listeners.
  private registered = false;

  constructor(
    private readonly lobbyDirectoryService: LobbyDirectoryService,
    private readonly loggerService: LoggerService,
    private readonly authSessionCleanupService: AuthSessionCleanupService,
    private readonly supabaseClientProvider: SupabaseClientProvider,
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
      // Close the Supabase client (no-op for supabase-js; exists for symmetry).
      // In-memory stores hold no handles and require no explicit close.
      this.supabaseClientProvider.close();
      this.lobbyDirectoryService.dispose();
      shutdownController.abort();
      Deno.exit();
    });
  }
}
