// Issue recorded when a runtime health check fails.
export interface Issue {
  level: 'warning' | 'error';
  code: string;
  message: string;
}

// Snapshot of server health at a point in time.
export interface ServerStatusSnapshot {
  status: 'healthy' | 'warning' | 'error';
  issues: Issue[];
  backend: string;
  startedAt: number;
  // Running server semver — included so the frontend can display the
  // server version on screens that fetch /status before the socket has
  // connected (e.g. the login page).
  version: string;
}

/**
 * Accumulates runtime health issues and produces status snapshots.
 *
 * Populated by ServerStartupService after storage open attempts. The
 * `snapshot()` method derives the overall status from the highest-severity
 * issue present: no issues → 'healthy', any warning → 'warning', any error
 * → 'error'. `startedAt` is recorded at construction time.
 */
export class ServerHealthService {
  private readonly issues: Issue[] = [];
  private backend: string = 'unknown';
  private readonly startedAt: number = Date.now();

  constructor(
    // Resolved from the root container's `serverVersion` value
    // registration so the version flows through DI rather than a global
    // import. Awilix CLASSIC mode resolves by parameter name.
    private readonly serverVersion: string,
  ) {}

  // Sets the active storage backend label for inclusion in snapshots.
  public setBackend(backend: string): void {
    this.backend = backend;
  }

  // Appends a runtime issue to the health log.
  public register(issue: Issue): void {
    this.issues.push(issue);
  }

  /**
   * Returns a point-in-time snapshot of server health.
   *
   * The `status` field is derived from the highest-severity issue recorded:
   * - 'error'   if any registered issue has level 'error'
   * - 'warning' if any registered issue has level 'warning' (and none are 'error')
   * - 'healthy' if no issues have been registered
   *
   * The returned `issues` array is a shallow copy so callers cannot mutate
   * the internal log.
   */
  public snapshot(): ServerStatusSnapshot {
    const status = this.issues.some(i => i.level === 'error')
      ? 'error'
      : this.issues.some(i => i.level === 'warning')
        ? 'warning'
        : 'healthy';
    return {
      status,
      issues: [...this.issues],
      backend: this.backend,
      startedAt: this.startedAt,
      version: this.serverVersion,
    };
  }
}
