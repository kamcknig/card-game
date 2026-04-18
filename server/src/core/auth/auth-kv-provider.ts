import type { LoggerService } from '../logger-service.ts';

/**
 * Lazily opens and shares a single `Deno.Kv` handle across the auth layer.
 *
 * The auth layer uses three KV-backed stores (sessions, users, and registration
 * codes). Deno KV does not allow multiple concurrent handles to the same
 * file-backed KV database in one process, so all three consumers must share
 * one handle.
 *
 * The caller (ServerStartupService) invokes `open(path)` once before the HTTP
 * server starts accepting connections. Subsequent `get()` calls return the
 * ready handle. `close()` is called during shutdown.
 *
 * Defined in: server/src/core/auth/auth-kv-provider.ts
 * Consumers: DenoKvUserStore, DenoKvRegistrationCodeStore, and
 *   DenoKvSessionStore (which historically opened its own handle and is
 *   migrated to share via `open(kv)` — see register-root-services.ts).
 *   Lifetime: Root singleton.
 */
export class AuthKvProvider {
  // Shared Deno KV handle; undefined until open() completes.
  private kv: Deno.Kv | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Opens the KV database at `path` (or reuses a provided handle).
   *
   * @param pathOrKv Filesystem path, `':memory:'`, or an already-opened KV
   *   handle. Passing an existing handle is useful in tests that want to
   *   control KV lifecycle manually.
   */
  public async open(pathOrKv: string | Deno.Kv): Promise<Deno.Kv> {
    if (this.kv) return this.kv;

    if (typeof pathOrKv === 'string') {
      this.loggerService.info(`[auth kv] opening shared KV store at '${pathOrKv}'`);
      this.kv = await Deno.openKv(pathOrKv);
    } else {
      this.kv = pathOrKv;
    }
    return this.kv;
  }

  /**
   * Returns the shared KV handle, or undefined when {@link open} has not run.
   *
   * Stores that tolerate being read before open() (e.g., during tests that use
   * the in-memory cache only) can check for undefined and no-op the KV write.
   */
  public get(): Deno.Kv | undefined {
    return this.kv;
  }

  /**
   * Closes the underlying KV handle on server shutdown.
   *
   * After close(), subsequent get() returns undefined. Pending fire-and-forget
   * writes from auth stores may fail; their errors are logged.
   */
  public close(): void {
    this.kv?.close();
    this.kv = undefined;
  }
}
