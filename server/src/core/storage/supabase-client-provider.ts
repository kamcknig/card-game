import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LoggerService } from '../logger-service.ts';

/**
 * Owns and vends the single shared `SupabaseClient` used by all Supabase-backed
 * store implementations.
 *
 * `open(url, key)` constructs the client once using the project URL and
 * service-role key. Subsequent calls to `get()` return the ready client.
 * `close()` is a no-op because `supabase-js` does not expose a close method.
 *
 * The supabase-js client is created with `auth.persistSession: false` because
 * the server uses the service-role key, which never requires token refresh, and
 * session persistence to disk would be a security risk in a server process.
 *
 * Defined in: server/src/core/storage/supabase-client-provider.ts
 * Consumers: Registered as `supabaseClientProvider` in register-root-services.ts.
 *   `open()` is called once from ServerStartupService when STORAGE_BACKEND=supabase.
 *   The client is then injected into each Supabase store via `get()`.
 */
export class SupabaseClientProvider {
  // Shared Supabase client; undefined until open() completes.
  private client: SupabaseClient | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Constructs and stores the Supabase client.
   *
   * Idempotent — subsequent calls with any arguments are no-ops when the
   * client is already open. The service-role key is used so all operations
   * bypass Row Level Security.
   *
   * @param url  The Supabase project URL (SUPABASE_URL env var).
   * @param key  The service-role secret key (SUPABASE_SERVICE_ROLE_KEY env var).
   */
  public open(url: string, key: string): void {
    if (this.client) return;

    this.loggerService.info(`[supabase] opening client for project: ${url}`);
    this.client = createClient(url, key, {
      auth: {
        // Disable session persistence — the server uses the service-role key
        // which never needs to be refreshed, and we do not want any token
        // state written to disk or memory beyond this process lifetime.
        persistSession: false,
      },
    });
    this.loggerService.log('[supabase] client ready');
  }

  /**
   * Returns the shared Supabase client.
   *
   * Throws when {@link open} has not been called yet. Callers should always
   * call `open()` during startup before invoking store `open()` methods.
   */
  public get(): SupabaseClient {
    if (!this.client) {
      throw new Error('[supabase] client not opened — call open(url, key) first');
    }
    return this.client;
  }

  /**
   * No-op — supabase-js does not expose a close/disconnect method.
   *
   * Exists so shutdown code can call `close()` on all providers uniformly
   * without special-casing this one.
   */
  public close(): void {
    // supabase-js has no close method; the client is garbage-collected with
    // the process. Logged for observability during shutdown.
    this.loggerService.debug('[supabase] close() called (no-op — supabase-js has no close method)');
    this.client = undefined;
  }
}
