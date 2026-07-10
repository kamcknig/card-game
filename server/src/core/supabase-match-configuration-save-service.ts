import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoggerService } from './logger-service.ts';
import { type CachedMatchConfigurationSave, MatchConfigurationSaveServiceBase } from './match-configuration-save-service-base.ts';
import type { MatchConfiguration } from 'shared/types/index.ts';

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
 * Supabase-backed implementation of {@link MatchConfigurationSaveStore}.
 *
 * Uses a write-through cache pattern: reads are served from the base class's
 * synchronous in-memory `Map`; mutations update the cache immediately (base
 * class) and this subclass's `onPersist` / `onDelete` / `onDeleteAll` hooks
 * fire async Supabase writes in the background.
 *
 * All saves are namespaced under the authenticated username so users never see
 * each other's saves. The cache key format is `'${usernameLower}::${saveKey}'`
 * so callers do not need to know the backing store.
 *
 * Table: `match_configuration_saves`; composite PK `(username_lower, save_key)`.
 * The `data` column holds the full `MatchConfiguration` object as JSONB.
 *
 * Defined in: server/src/core/supabase-match-configuration-save-service.ts
 * Consumers: Registered as `matchConfigurationSaveService` in register-root-services.ts
 *   when STORAGE_BACKEND=supabase. `open()` is called from ServerStartupService.
 */
export class SupabaseMatchConfigurationSaveService extends MatchConfigurationSaveServiceBase {
  // Shared Supabase client; set in open().
  private client: SupabaseClient | undefined;

  constructor(loggerService: LoggerService) {
    super(loggerService);
  }

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
      const ck = `${row.username_lower}::${row.save_key}`;
      this.cache.set(ck, {
        name: row.display_name,
        savedAtMs: row.updated_at,
        createdAtMs: row.created_at,
        configuration: row.data,
      });
      loaded++;
    }

    this.loggerService.info(`[match config saves] loaded ${loaded} save(s) from Supabase`);
  }

  /**
   * Upserts the given save record to the DB in the background.
   *
   * Uses `onConflict: 'username_lower, save_key'` so re-saves are treated as
   * updates. Writes `save.createdAtMs` (not the current time) so repeated
   * upserts on an existing save never clobber its original creation
   * timestamp; `save.savedAtMs` is the last-modified time. Errors are logged
   * but do not propagate.
   */
  protected override onPersist(usernameLower: string, saveKey: string, save: CachedMatchConfigurationSave): void {
    const row: DbMatchConfigSaveRow = {
      username_lower: usernameLower,
      save_key: saveKey,
      display_name: save.name,
      data: save.configuration,
      created_at: save.createdAtMs,
      updated_at: save.savedAtMs,
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

  /**
   * Deletes the row for a single save from the DB in the background. Errors
   * are logged but do not propagate.
   */
  protected override onDelete(usernameLower: string, saveKey: string): void {
    this.client
      ?.from('match_configuration_saves')
      .delete()
      .eq('username_lower', usernameLower)
      .eq('save_key', saveKey)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[match config saves] delete failed for '${usernameLower}/${saveKey}': ${error.message}`);
        }
      });
  }

  /**
   * Deletes every row for `username` (or every row, when omitted) from the DB
   * in the background. Errors are logged but do not propagate.
   */
  protected override onDeleteAll(username: string | undefined, _deletedKeys: string[]): void {
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
}
