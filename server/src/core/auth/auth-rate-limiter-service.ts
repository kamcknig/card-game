import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';

// Abstract clock so tests can advance time without real timers.
export type Clock = { now(): number };

// Default system clock backed by Date.now().
export const systemClock: Clock = { now: () => Date.now() };

/**
 * Per-IP sliding-window rate limiter for failed login attempts.
 *
 * Records failed login attempts keyed by client IP and reports whether a
 * given IP has exceeded its configured quota inside the current window.
 * Entries expire automatically — GC runs on each read so no separate sweep
 * is needed. Limits and window duration come from ServerConfigService.
 *
 * The clock dependency is injectable so tests can advance time without
 * real timers, keeping test execution deterministic and fast.
 *
 * No cross-process coordination — single-instance only. State is lost on
 * restart, which is acceptable because rate-limit state is advisory.
 *
 * Lifetime: Root singleton, shared with ServerAuthRouteHandlerService.
 * JS is single-threaded; no locking is required.
 */
export class AuthRateLimiterService {
  // Maps each IP to an array of timestamps of its failed attempts.
  private readonly failedAttempts = new Map<string, number[]>();

  constructor(
    private readonly loggerService: LoggerService,
    private readonly serverConfigService: ServerConfigService,
    private readonly clock: Clock = systemClock,
  ) {}

  /**
   * Returns true when the IP has exceeded the configured failure budget.
   *
   * Runs GC before checking so expired attempts are not counted against
   * the current window.
   */
  public isLimited(ip: string): boolean {
    this.gc(ip);
    const max = this.serverConfigService.getAuthRateLimitMaxAttempts();
    const attempts = this.failedAttempts.get(ip) ?? [];
    const limited = attempts.length >= max;
    if (limited) {
      this.loggerService.debug(`[auth rate limiter] IP ${ip} is rate-limited (${attempts.length}/${max} attempts)`);
    }
    return limited;
  }

  /**
   * Records a failed login for this IP at the current clock time.
   *
   * Call after any login failure — wrong password, bad JSON, unknown
   * provider, etc. — so all failure modes count toward the limit.
   */
  public recordFailure(ip: string): void {
    const now = this.clock.now();
    const attempts = this.failedAttempts.get(ip) ?? [];
    attempts.push(now);
    this.failedAttempts.set(ip, attempts);
    this.loggerService.debug(`[auth rate limiter] recorded failure for IP ${ip} (total: ${attempts.length})`);
  }

  /**
   * Clears rate-limiter state for this IP.
   *
   * Call on a successful login so a legitimate user's counter resets and
   * subsequent failures start a fresh window.
   */
  public reset(ip: string): void {
    const deleted = this.failedAttempts.delete(ip);
    if (deleted) {
      this.loggerService.debug(`[auth rate limiter] reset counter for IP ${ip}`);
    }
  }

  /**
   * Returns the number of milliseconds until this IP's oldest recorded
   * attempt exits the current window.
   *
   * Returns 0 when there are no recorded attempts or they have all expired.
   * Used to populate the Retry-After response header.
   */
  public retryAfterMs(ip: string): number {
    this.gc(ip);
    const attempts = this.failedAttempts.get(ip) ?? [];
    if (attempts.length === 0) return 0;
    const windowMs = this.serverConfigService.getAuthRateLimitWindowMs();
    const oldest = attempts[0];
    return Math.max(0, oldest + windowMs - this.clock.now());
  }

  /**
   * Drops entries older than the sliding window for a single IP.
   *
   * Removes the IP's map entry entirely when all its attempts have expired
   * so the map does not grow unbounded.
   */
  private gc(ip: string): void {
    const attempts = this.failedAttempts.get(ip);
    if (!attempts) return;
    const windowMs = this.serverConfigService.getAuthRateLimitWindowMs();
    const cutoff = this.clock.now() - windowMs;
    const live = attempts.filter(t => t >= cutoff);
    if (live.length === 0) {
      this.failedAttempts.delete(ip);
    } else if (live.length !== attempts.length) {
      this.failedAttempts.set(ip, live);
    }
  }
}
