import { AuthSessionService } from './auth-session-service.ts';
import { LoggerService } from '../logger-service.ts';

/**
 * Periodically purges expired auth sessions from the session store.
 *
 * Delegates to `AuthSessionService.purgeExpiredSessions()`, which issues a
 * single efficient sweep across the backing store (O(n) pass for the
 * in-memory backend; a single atomic operation for Deno KV). This ensures
 * garbage collection runs on a regular cadence even when no requests are
 * actively validating tokens, preventing unbounded growth in long-running
 * deployments.
 *
 * The interval is configurable at start time; the default is 5 minutes,
 * which is sufficient for most deployments. The timer is automatically
 * cancelled when `stop()` is called (e.g., on server shutdown).
 *
 * Lifetime: Root singleton. Start via ServerStartupService, stop via
 * ServerShutdownHandlerService.
 */
export class AuthSessionCleanupService {
  // setInterval handle; undefined means the timer is not running.
  private handle: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Starts the periodic cleanup timer.
   *
   * Calling start() when the timer is already running is a no-op.
   * Each tick calls `purgeExpiredSessions()` which efficiently removes all
   * expired sessions from the backing store in a single operation.
   *
   * @param intervalMs How often to sweep for expired sessions. Default: 5 minutes.
   */
  public start(intervalMs: number = 5 * 60_000): void {
    if (this.handle !== undefined) {
      this.loggerService.debug('[auth cleanup] timer already running; ignoring start()');
      return;
    }

    this.loggerService.info(`[auth cleanup] starting session cleanup timer (interval: ${intervalMs}ms)`);

    this.handle = setInterval(() => {
      // purgeExpiredSessions() performs a single efficient sweep and logs
      // the count of removed sessions at the info level when > 0.
      const count = this.authSessionService.purgeExpiredSessions();
      this.loggerService.debug(`[auth cleanup] sweep complete; ${count} expired session(s) removed`);
    }, intervalMs);
  }

  /**
   * Stops the periodic cleanup timer.
   *
   * Safe to call multiple times or when the timer was never started.
   */
  public stop(): void {
    if (this.handle !== undefined) {
      clearInterval(this.handle);
      this.handle = undefined;
      this.loggerService.info('[auth cleanup] session cleanup timer stopped');
    }
  }
}
