import type { LoggerService } from './logger-service.ts';
import type { MatchConfigurationSaveStore } from './match-configuration-save-store.ts';
import type {
  MatchConfiguration,
  MatchConfigurationSaveNameCheckResult,
  MatchConfigurationSaveResult,
  SavedMatchConfigurationEntry,
} from 'shared/types/index.ts';

/** KV top-level prefix for all match-configuration saves. */
const KEY_PREFIX = 'match_config_saves';

// Shape of the value stored in KV for each save.
type PersistedMatchConfigurationSave = {
  name: string;
  savedAtMs: number;
  configuration: MatchConfiguration;
};

/**
 * Deno KV-backed implementation of {@link MatchConfigurationSaveStore}.
 *
 * All saves are namespaced under the authenticated username so users never see
 * each other's saves. Uses the write-through cache pattern: reads are served
 * from a synchronous `Map`; writes mutate the cache and fire async KV writes
 * in the background (fire-and-forget, errors are logged).
 *
 * KV key format: `['match_config_saves', usernameLowercase, normalizedKey]`
 * Cache key:     composite string `'${usernameLower}::${normalizedKey}'`
 *
 * Defined in: server/src/core/deno-kv-match-configuration-save-service.ts
 * Consumers: Registered as `matchConfigurationSaveService` in register-root-services.ts
 *   when GAME_DATA_STORE=kv.
 *   `open()` must be called from ServerStartupService before HTTP accepts connections.
 */
export class DenoKvMatchConfigurationSaveService implements MatchConfigurationSaveStore {
  // Write-through cache keyed by composite 'usernameLower::normalizedKey'.
  private readonly cache = new Map<string, PersistedMatchConfigurationSave>();

  // Shared KV handle; undefined until open() completes.
  private kv: Deno.Kv | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Loads all saves from KV into the in-memory cache.
   *
   * Must be called before any synchronous store method. Accepts an already-opened
   * KV handle (shared via GameDataKvProvider) or a path string (tests).
   */
  public async open(pathOrKv: string | Deno.Kv): Promise<void> {
    this.kv = typeof pathOrKv === 'string' ? await Deno.openKv(pathOrKv) : pathOrKv;

    let loaded = 0;
    for await (const entry of this.kv.list<PersistedMatchConfigurationSave>({ prefix: [KEY_PREFIX] })) {
      const [, username, normalizedKey] = entry.key as [string, string, string];
      if (entry.value && typeof entry.value === 'object' && 'configuration' in entry.value) {
        this.cache.set(this.cacheKey(username, normalizedKey), entry.value);
        loaded++;
      }
    }
    this.loggerService.info(`[match config saves] loaded ${loaded} save(s) from KV store`);
  }

  /**
   * Validates and normalizes a save name for the given user.
   *
   * Returns `isValid: false` when the name cannot be normalized to a non-empty
   * key, and `exists: true` when a save with that normalized key already exists
   * for the user.
   */
  public checkSaveName(username: string, name: string): MatchConfigurationSaveNameCheckResult {
    const requestedName = name;
    const normalizedName = this.normalizeSaveName(name);
    if (!normalizedName) {
      return {
        requestedName,
        normalizedName,
        isValid: false,
        exists: false,
        reason: 'Enter a valid name using letters, numbers, spaces, hyphens, or underscores.',
      };
    }
    return {
      requestedName,
      normalizedName,
      isValid: true,
      exists: this.cache.has(this.cacheKey(username, normalizedName)),
    };
  }

  /**
   * Returns all saves belonging to `username`, sorted newest first.
   *
   * Only entries whose composite cache key begins with `usernameLower::` are
   * included; other users' saves are never visible.
   */
  public listSavedConfigurations(username: string): SavedMatchConfigurationEntry[] {
    const prefix = `${username.toLowerCase()}::`;
    const entries: SavedMatchConfigurationEntry[] = [];
    for (const [key, save] of this.cache) {
      if (!key.startsWith(prefix)) continue;
      const normalizedKey = key.slice(prefix.length);
      entries.push({ key: normalizedKey, name: save.name, savedAtMs: save.savedAtMs });
    }
    return entries.sort((a, b) => b.savedAtMs - a.savedAtMs || a.name.localeCompare(b.name));
  }

  /**
   * Returns all saves across all users — admin/debug use only.
   *
   * The `key` field on each entry is the full composite cache key
   * (`usernameLower::normalizedKey`) so callers can distinguish entries from
   * different users.
   */
  public listAllSavedConfigurations(): SavedMatchConfigurationEntry[] {
    const result: SavedMatchConfigurationEntry[] = [];
    for (const [compositeKey, save] of this.cache) {
      result.push({ key: compositeKey, name: save.name, savedAtMs: save.savedAtMs });
    }
    return result.sort((a, b) => b.savedAtMs - a.savedAtMs || a.name.localeCompare(b.name));
  }

  /**
   * Persists a configuration under the given name for the given user.
   *
   * When a save with the same normalized key already exists it is overwritten.
   * The display name is the trimmed raw input; the normalized key is used for
   * storage and lookup. Fires a background KV write after updating the cache.
   */
  public saveConfiguration(username: string, name: string, configuration: MatchConfiguration): MatchConfigurationSaveResult {
    const check = this.checkSaveName(username, name);
    if (!check.isValid) {
      return { ok: false, name: name.trim(), message: check.reason ?? 'Invalid save name.' };
    }

    const trimmedName = name.trim();
    const payload: PersistedMatchConfigurationSave = {
      // Prefer the trimmed raw name as the display name; fall back to the normalized key.
      name: trimmedName.length > 0 ? trimmedName : check.normalizedName,
      savedAtMs: Date.now(),
      configuration: structuredClone(configuration),
    };

    const ck = this.cacheKey(username, check.normalizedName);
    this.cache.set(ck, payload);
    this.persist(username, check.normalizedName, payload);

    this.loggerService.info(
      `[match config saves] ${check.exists ? 'overwrote' : 'saved'} '${payload.name}' for user '${username}' (${check.normalizedName})`,
    );
    return { ok: true, name: payload.name };
  }

  /**
   * Returns the raw configuration for a saved key.
   *
   * Returns `ok: false` when the key cannot be normalized or no matching save
   * exists for the user.
   */
  public loadConfiguration(
    username: string,
    key: string,
  ): { ok: true; key: string; configuration: MatchConfiguration } | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return { ok: false, key, message: 'Invalid saved configuration key.' };
    }

    const save = this.cache.get(this.cacheKey(username, normalizedKey));
    if (!save) {
      return { ok: false, key: normalizedKey, message: 'Saved configuration was not found.' };
    }
    return { ok: true, key: normalizedKey, configuration: structuredClone(save.configuration) };
  }

  /**
   * Returns a save entry with metadata and configuration.
   *
   * Returns `ok: false` when the key cannot be normalized or no matching save
   * exists for the user.
   */
  public getSavedConfiguration(
    username: string,
    key: string,
  ):
    | { ok: true; entry: SavedMatchConfigurationEntry; configuration: MatchConfiguration }
    | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return { ok: false, key, message: 'Invalid saved configuration key.' };
    }

    const save = this.cache.get(this.cacheKey(username, normalizedKey));
    if (!save) {
      return { ok: false, key: normalizedKey, message: 'Saved configuration was not found.' };
    }
    return {
      ok: true,
      entry: { key: normalizedKey, name: save.name, savedAtMs: save.savedAtMs },
      configuration: structuredClone(save.configuration),
    };
  }

  /**
   * Replaces the configuration for an existing save, optionally renaming it.
   *
   * When `requestedName` is provided and non-empty it becomes the new display
   * name; otherwise the current display name is preserved. Returns `ok: false`
   * when the key is invalid or the save does not exist.
   */
  public updateConfiguration(
    username: string,
    key: string,
    configuration: MatchConfiguration,
    requestedName?: string,
  ): { ok: true; key: string; name: string } | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return { ok: false, key, message: 'Invalid saved configuration key.' };
    }

    const ck = this.cacheKey(username, normalizedKey);
    const existing = this.cache.get(ck);
    if (!existing) {
      return { ok: false, key: normalizedKey, message: 'Saved configuration was not found.' };
    }

    // Prefer the caller-supplied name; fall back to the existing display name;
    // ultimately fall back to the normalized key when neither is usable.
    const trimmedRequested = requestedName?.trim() ?? '';
    const resolvedName =
      trimmedRequested.length > 0
        ? trimmedRequested
        : existing.name.trim().length > 0
          ? existing.name
          : normalizedKey;

    const payload: PersistedMatchConfigurationSave = {
      name: resolvedName,
      savedAtMs: Date.now(),
      configuration: structuredClone(configuration),
    };

    this.cache.set(ck, payload);
    this.persist(username, normalizedKey, payload);

    this.loggerService.info(`[match config saves] updated '${resolvedName}' for user '${username}' (${normalizedKey})`);
    return { ok: true, key: normalizedKey, name: resolvedName };
  }

  /**
   * Deletes one save for the given user.
   *
   * Returns `ok: false` when the key is invalid or the save does not exist.
   * The KV deletion is fire-and-forget; errors are logged.
   */
  public deleteConfiguration(
    username: string,
    key: string,
  ): { ok: true; key: string } | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return { ok: false, key, message: 'Invalid saved configuration key.' };
    }

    const ck = this.cacheKey(username, normalizedKey);
    if (!this.cache.has(ck)) {
      return { ok: false, key: normalizedKey, message: 'Saved configuration was not found.' };
    }

    this.cache.delete(ck);
    this.kv?.delete([KEY_PREFIX, username.toLowerCase(), normalizedKey]).catch((err: unknown) => {
      this.loggerService.warn(`[match config saves] delete failed for '${username}/${normalizedKey}': ${err}`);
    });

    this.loggerService.info(`[match config saves] deleted '${normalizedKey}' for user '${username}'`);
    return { ok: true, key: normalizedKey };
  }

  /**
   * Deletes saves for `username` when provided, or all saves across all users when omitted.
   *
   * Each KV deletion is fire-and-forget; errors are logged individually.
   * Admin/debug use when no username is given.
   */
  public deleteAllConfigurations(
    username?: string,
  ): { ok: true; removed: number } | { ok: false; removed: number; message: string } {
    const prefix = username ? `${username.toLowerCase()}::` : undefined;
    const toDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (!prefix || key.startsWith(prefix)) {
        toDelete.push(key);
      }
    }

    for (const ck of toDelete) {
      // Composite key format: 'usernameLower::normalizedKey'
      const separatorIndex = ck.indexOf('::');
      const u = ck.slice(0, separatorIndex);
      const normalizedKey = ck.slice(separatorIndex + 2);

      this.cache.delete(ck);
      this.kv?.delete([KEY_PREFIX, u, normalizedKey]).catch((err: unknown) => {
        this.loggerService.warn(`[match config saves] delete-all failed for '${ck}': ${err}`);
      });
    }

    this.loggerService.info(
      `[match config saves] deleted ${toDelete.length} save(s)${username ? ` for user '${username}'` : ' (all users)'}`,
    );
    return { ok: true, removed: toDelete.length };
  }

  /**
   * Builds a composite cache key from username and normalized save key.
   *
   * The double-colon separator (`::`) is safe because normalized keys only
   * contain `[A-Za-z0-9_-]` and usernames similarly exclude `::`.
   */
  private cacheKey(username: string, normalizedKey: string): string {
    return `${username.toLowerCase()}::${normalizedKey}`;
  }

  /**
   * Normalizes user-provided save names into safe storage keys.
   *
   * Trims whitespace, collapses internal whitespace runs to a single hyphen,
   * strips characters that are not alphanumeric, hyphens, or underscores, and
   * caps the result at 64 characters. Returns an empty string when the input
   * has no usable characters.
   */
  private normalizeSaveName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 64);
  }

  /**
   * Writes the current in-memory record back to KV in the background.
   *
   * Mutations happen on the cached object before this is called; this method
   * echoes the updated state to the KV store. Errors are logged but do not
   * propagate to the caller.
   */
  private persist(username: string, normalizedKey: string, save: PersistedMatchConfigurationSave): void {
    this.kv?.set([KEY_PREFIX, username.toLowerCase(), normalizedKey], save).catch((err: unknown) => {
      this.loggerService.warn(`[match config saves] persist failed for '${username}/${normalizedKey}': ${err}`);
    });
  }
}
