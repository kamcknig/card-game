import { AuthSessionService } from './auth-session-service.ts';
import { LoggerService } from '../logger-service.ts';

/**
 * Periodically prunes expired auth sessions from the in-memory session store.
 *
 * `AuthSessionService.listSessions()` already evicts expired entries as a
 * side effect of each call, so this service exists purely to ensure that
 * garbage collection runs on a regular cadence even when no requests are
 * actively validating tokens. This prevents unbounded memory growth in
 * long-running deployments with many short-lived sessions.
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
   * `listSessions()` handles the actual expiry sweep and returns only
   * non-expired records, so comparing the count before and after the second
   * call (which runs against the already-pruned set) always yields 0.
   * Instead, we measure the count before the first call to detect removals.
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
      // listSessions() prunes expired entries as a side effect and returns
      // only the live set. We call it once and rely on its internal count
      // to observe the prune result via debug logging inside the service.
      const live = this.authSessionService.listSessions();
      this.loggerService.debug(`[auth cleanup] sweep complete; ${live.length} active session(s) remain`);
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
