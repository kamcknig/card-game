import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoggerService } from './logger-service.ts';
import type { MatchConfigurationSaveStore } from './match-configuration-save-store.ts';
import type {
  MatchConfiguration,
  MatchConfigurationSaveNameCheckResult,
  MatchConfigurationSaveResult,
  SavedMatchConfigurationEntry,
} from 'shared/types/index.ts';

/**
 * Shape of a row in the `match_configuration_saves` Supabase table.
 */
type DbMatchConfigSaveRow = {
  username_lower: string;
  save_key: string;
  display_name: string;
  data: MatchConfiguration;
  created_at: number;
  updated_at: number;
};

/**
 * In-memory representation of a single save (mirrors the KV shape).
 */
type CachedSave = {
  name: string;
  savedAtMs: number;
  configuration: MatchConfiguration;
};

/**
 * Supabase-backed implementation of {@link MatchConfigurationSaveStore}.
 *
 * Uses the same write-through cache pattern as {@link DenoKvMatchConfigurationSaveService}:
 * reads are served from a synchronous in-memory `Map`; mutations update the
 * cache immediately and fire async Supabase writes in the background.
 *
 * All saves are namespaced under the authenticated username so users never see
 * each other's saves. The cache key format is `'${usernameLower}::${saveKey}'`
 * (identical to the KV implementation) so callers do not need to know the
 * backing store.
 *
 * Table: `match_configuration_saves`; composite PK `(username_lower, save_key)`.
 * The `data` column holds the full `MatchConfiguration` object as JSONB.
 *
 * Defined in: server/src/core/supabase-match-configuration-save-service.ts
 * Consumers: Registered as `matchConfigurationSaveService` in register-root-services.ts
 *   when STORAGE_BACKEND=supabase. `open()` is called from ServerStartupService.
 */
export class SupabaseMatchConfigurationSaveService implements MatchConfigurationSaveStore {
  // Write-through cache keyed by composite 'usernameLower::saveKey'.
  private readonly cache = new Map<string, CachedSave>();

  // Shared Supabase client; set in open().
  private client: SupabaseClient | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Loads all match-configuration save rows into the in-memory cache.
   *
   * Must be called once during server startup before the HTTP server accepts
   * connections. Populates the per-user cache from `match_configuration_saves`.
   */
  public async open(client: SupabaseClient): Promise<void> {
    this.client = client;

    const { data, error } = await this.client.from('match_configuration_saves').select('*');
    if (error) {
      throw new Error(`[match config saves] failed to load from Supabase: ${error.message}`);
    }

    let loaded = 0;
    for (const row of (data ?? []) as DbMatchConfigSaveRow[]) {
      const ck = this.cacheKey(row.username_lower, row.save_key);
      this.cache.set(ck, {
        name: row.display_name,
        savedAtMs: row.updated_at,
        configuration: row.data,
      });
      loaded++;
    }

    this.loggerService.info(`[match config saves] loaded ${loaded} save(s) from Supabase`);
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
   * Fires a background DB upsert after updating the cache.
   */
  public saveConfiguration(username: string, name: string, configuration: MatchConfiguration): MatchConfigurationSaveResult {
    const check = this.checkSaveName(username, name);
    if (!check.isValid) {
      return { ok: false, name: name.trim(), message: check.reason ?? 'Invalid save name.' };
    }

    const trimmedName = name.trim();
    const now = Date.now();
    const payload: CachedSave = {
      name: trimmedName.length > 0 ? trimmedName : check.normalizedName,
      savedAtMs: now,
      configuration: structuredClone(configuration),
    };

    const usernameLower = username.toLowerCase();
    const ck = this.cacheKey(usernameLower, check.normalizedName);
    this.cache.set(ck, payload);

    this.persist(usernameLower, check.normalizedName, payload, now);

    this.loggerService.info(
      `[match config saves] ${check.exists ? 'overwrote' : 'saved'} '${payload.name}' for user '${username}' (${check.normalizedName})`,
    );
    return { ok: true, name: payload.name };
  }

  /**
   * Returns the raw configuration for a saved key.
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

    const trimmedRequested = requestedName?.trim() ?? '';
    const resolvedName =
      trimmedRequested.length > 0
        ? trimmedRequested
        : existing.name.trim().length > 0
          ? existing.name
          : normalizedKey;

    const now = Date.now();
    const payload: CachedSave = {
      name: resolvedName,
      savedAtMs: now,
      configuration: structuredClone(configuration),
    };

    this.cache.set(ck, payload);
    this.persist(usernameLower, normalizedKey, payload, now);

    this.loggerService.info(`[match config saves] updated '${resolvedName}' for user '${username}' (${normalizedKey})`);
    return { ok: true, key: normalizedKey, name: resolvedName };
  }

  /**
   * Deletes one save for the given user.
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

    this.client
      ?.from('match_configuration_saves')
      .delete()
      .eq('username_lower', usernameLower)
      .eq('save_key', normalizedKey)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[match config saves] delete failed for '${username}/${normalizedKey}': ${error.message}`);
        }
      });

    this.loggerService.info(`[match config saves] deleted '${normalizedKey}' for user '${username}'`);
    return { ok: true, key: normalizedKey };
  }

  /**
   * Deletes saves for `username` when provided, or all saves when omitted.
   *
   * Each removal updates the cache synchronously. DB deletes are
   * fire-and-forget.
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
      let query = this.client?.from('match_configuration_saves').delete();
      if (username) {
        query = query?.eq('username_lower', username.toLowerCase());
      } else {
        // Delete all rows — use a filter that always matches.
        query = query?.neq('save_key', '');
      }
      query?.then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[match config saves] delete-all failed${username ? ` for '${username}'` : ''}: ${error.message}`);
        }
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
  private cacheKey(usernameLower: string, saveKey: string): string {
    return `${usernameLower}::${saveKey}`;
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
   * Upserts the given save record to the DB in the background.
   *
   * Uses `onConflict: 'username_lower, save_key'` so re-saves are treated as
   * updates. Errors are logged but do not propagate.
   */
  private persist(usernameLower: string, saveKey: string, save: CachedSave, now: number): void {
    const row: DbMatchConfigSaveRow = {
      username_lower: usernameLower,
      save_key: saveKey,
      display_name: save.name,
      data: save.configuration,
      created_at: now,
      updated_at: now,
    };

    this.client
      ?.from('match_configuration_saves')
      .upsert(row, { onConflict: 'username_lower, save_key' })
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[match config saves] persist failed for '${usernameLower}/${saveKey}': ${error.message}`);
        }
      });
  }
}
