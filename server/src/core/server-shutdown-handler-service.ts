import { Game } from './game.ts';
import { LoggerService } from './logger-service.ts';

/**
 * Owns process shutdown signal handling for graceful server teardown.
 */
export class ServerShutdownHandlerService {
  // Tracks registration state to prevent duplicate listeners.
  private registered = false;

  constructor(
    private readonly game: Game,
    private readonly loggerService: LoggerService,
  ) {
  }

  // Registers SIGINT behavior to dispose runtime resources and stop serving.
  public registerShutdownHandler(shutdownController: AbortController): void {
    if (this.registered) {
      this.loggerService.warn('[server shutdown handler] shutdown handler already registered; skipping');
      return;
    }

    this.registered = true;
    addEventListener('SIGINT', () => {
      this.loggerService.log('Shutting down cleanly...');
      this.game.dispose();
      shutdownController.abort();
      Deno.exit();
    });
  }
}
