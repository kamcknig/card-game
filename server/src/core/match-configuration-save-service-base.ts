import type { LoggerService } from './logger-service.ts';
import type { MatchConfigurationSaveStore } from './match-configuration-save-store.ts';
import type {
  MatchConfiguration,
  MatchConfigurationSaveNameCheckResult,
  MatchConfigurationSaveResult,
  SavedMatchConfigurationEntry,
} from 'shared/types/index.ts';

// Shape of each entry held in the cache. `createdAtMs` is tracked separately
// from `savedAtMs` (last-modified) even for backends with no external store,
// so a single cache shape can be shared by every implementation.
export type CachedMatchConfigurationSave = {
  name: string;
  savedAtMs: number;
  createdAtMs: number;
  configuration: MatchConfiguration;
};

/**
 * Cache-backed base implementation of {@link MatchConfigurationSaveStore}.
 *
 * Owns the composite-key cache (`'${usernameLower}::${normalizedKey}'`), save
 * name normalization/validation, sorting, and every read/write code path
 * common to both backends. Concrete subclasses hook into `onPersist` /
 * `onDelete` / `onDeleteAll` to fan mutations out to a backing store; the
 * default hooks are no-ops, which is exactly the in-memory backend's
 * behavior.
 *
 * All per-user methods normalize the username via `cacheKey()` regardless of
 * what casing the caller passes in — historically some call sites passed the
 * raw (possibly mixed-case) username while others pre-lowercased it, which
 * produced cache-key mismatches between the save path and the load/check
 * paths. Normalizing once here (rather than in each subclass) removes that
 * bug class entirely.
 *
 * Defined in: server/src/core/match-configuration-save-service-base.ts
 * Subclasses: InMemoryMatchConfigurationSaveService (STORAGE_BACKEND=in-memory),
 *   SupabaseMatchConfigurationSaveService (STORAGE_BACKEND=supabase).
 */
export abstract class MatchConfigurationSaveServiceBase implements MatchConfigurationSaveStore {
  // Composite key: 'usernameLower::normalizedKey'
  protected readonly cache = new Map<string, CachedMatchConfigurationSave>();

  constructor(protected readonly loggerService: LoggerService) {}

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
   * When a save with the same normalized key already exists it is overwritten
   * and its original `createdAtMs` is preserved; only a brand-new key gets
   * `createdAtMs = now`. Calls `onPersist` after updating the cache so
   * subclasses can fan the write out to a backing store.
   */
  public saveConfiguration(username: string, name: string, configuration: MatchConfiguration): MatchConfigurationSaveResult {
    const check = this.checkSaveName(username, name);
    if (!check.isValid) {
      return { ok: false, name: name.trim(), message: check.reason ?? 'Invalid save name.' };
    }

    const trimmedName = name.trim();
    const now = Date.now();
    const usernameLower = username.toLowerCase();
    const ck = this.cacheKey(usernameLower, check.normalizedName);
    const existingRecord = this.cache.get(ck);
    const payload: CachedMatchConfigurationSave = {
      // Prefer the trimmed raw name as the display name; fall back to the normalized key.
      name: trimmedName.length > 0 ? trimmedName : check.normalizedName,
      savedAtMs: now,
      createdAtMs: existingRecord?.createdAtMs ?? now,
      configuration: structuredClone(configuration),
    };

    this.cache.set(ck, payload);
    this.onPersist(usernameLower, check.normalizedName, payload);

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
   * name; otherwise the current display name is preserved. Preserves the
   * original `createdAtMs`. Returns `ok: false` when the key is invalid or
   * the save does not exist.
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
    const usernameLower = username.toLowerCase();
    const ck = this.cacheKey(usernameLower, normalizedKey);
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

    const payload: CachedMatchConfigurationSave = {
      name: resolvedName,
      savedAtMs: Date.now(),
      // Preserve the original creation timestamp — this is always an update
      // of an existing save (guarded by the `!existing` check above).
      createdAtMs: existing.createdAtMs,
      configuration: structuredClone(configuration),
    };
    this.cache.set(ck, payload);
    this.onPersist(usernameLower, normalizedKey, payload);

    this.loggerService.info(`[match config saves] updated '${resolvedName}' for user '${username}' (${normalizedKey})`);
    return { ok: true, key: normalizedKey, name: resolvedName };
  }

  /**
   * Deletes one save for the given user.
   *
   * Returns `ok: false` when the key is invalid or the save does not exist.
   */
  public deleteConfiguration(
    username: string,
    key: string,
  ): { ok: true; key: string } | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return { ok: false, key, message: 'Invalid saved configuration key.' };
    }
    const usernameLower = username.toLowerCase();
    const ck = this.cacheKey(usernameLower, normalizedKey);
    if (!this.cache.has(ck)) {
      return { ok: false, key: normalizedKey, message: 'Saved configuration was not found.' };
    }
    this.cache.delete(ck);
    this.onDelete(usernameLower, normalizedKey);

    this.loggerService.info(`[match config saves] deleted '${normalizedKey}' for user '${username}'`);
    return { ok: true, key: normalizedKey };
  }

  /**
   * Deletes saves for `username` when provided, or all saves across all users when omitted.
   *
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
      this.cache.delete(ck);
    }

    if (toDelete.length > 0) {
      this.onDeleteAll(username, toDelete);
    }

    this.loggerService.info(
      `[match config saves] deleted ${toDelete.length} save(s)${username ? ` for user '${username}'` : ' (all users)'}`,
    );
    return { ok: true, removed: toDelete.length };
  }

  /**
   * Fired after a save/update is written to the cache. No-op by default;
   * subclasses override to fan the write out to a backing store.
   */
  protected onPersist(_usernameLower: string, _saveKey: string, _save: CachedMatchConfigurationSave): void {}

  /**
   * Fired after a single save is removed from the cache. No-op by default;
   * subclasses override to fan the delete out to a backing store.
   */
  protected onDelete(_usernameLower: string, _saveKey: string): void {}

  /**
   * Fired after a bulk delete completes on the cache (only when at least one
   * key was removed). `deletedKeys` are full composite cache keys. No-op by
   * default; subclasses override to fan the delete out to a backing store.
   */
  protected onDeleteAll(_username: string | undefined, _deletedKeys: string[]): void {}

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
}
