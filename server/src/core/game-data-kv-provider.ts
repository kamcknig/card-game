import type { LoggerService } from './logger-service.ts';

/**
 * Lazily opens and shares a single `Deno.Kv` handle for the game-data KV store.
 *
 * Keeps game-data persistence (match configuration saves, etc.) in a separate KV
 * file from the auth store (AUTH_KV_PATH). Multiple consumers that must share the
 * same handle call `open()` once; subsequent `get()` calls return the ready handle.
 *
 * Defined in: server/src/core/game-data-kv-provider.ts
 * Consumers: DenoKvMatchConfigurationSaveService.
 * Lifetime: Root singleton. `open()` is called from ServerStartupService.
 */
export class GameDataKvProvider {
  // Shared Deno KV handle; undefined until open() completes.
  private kv: Deno.Kv | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Opens the KV database at `path` (or reuses a provided handle).
   *
   * @param pathOrKv Filesystem path, `':memory:'`, or an already-opened handle.
   */
  public async open(pathOrKv: string | Deno.Kv): Promise<Deno.Kv> {
    if (this.kv) return this.kv;

    if (typeof pathOrKv === 'string') {
      this.loggerService.info(`[game data kv] opening shared KV store at '${pathOrKv}'`);
      this.kv = await Deno.openKv(pathOrKv);
    } else {
      this.kv = pathOrKv;
    }
    return this.kv;
  }

  /**
   * Returns the shared KV handle, or undefined when {@link open} has not run.
   *
   * Consumers that tolerate being read before open() can check for undefined
   * and no-op the KV write.
   */
  public get(): Deno.Kv | undefined {
    return this.kv;
  }

  /**
   * Closes the underlying KV handle on server shutdown.
   *
   * After close(), subsequent get() returns undefined. Pending fire-and-forget
   * writes may fail; their errors are logged.
   */
  public close(): void {
    this.kv?.close();
    this.kv = undefined;
  }
}
