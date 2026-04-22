import type {
  MatchConfiguration,
  MatchConfigurationSaveNameCheckResult,
  MatchConfigurationSaveResult,
  SavedMatchConfigurationEntry,
} from 'shared/types/index.ts';

/**
 * Persistence contract for named match-configuration saves.
 *
 * Per-user methods require a `username` (the authenticated username, lowercased
 * internally). Admin methods (`listAllSavedConfigurations`, `deleteAllConfigurations`
 * without a username) are used only by debug/admin routes.
 *
 * Defined in: server/src/core/match-configuration-save-store.ts
 * Implementations: MatchConfigurationSaveService (file), DenoKvMatchConfigurationSaveService (KV).
 * Consumers: Game (socket handlers), ServerDebugRouteHandlerService (HTTP debug API).
 */
export interface MatchConfigurationSaveStore {
  /** Validates and normalizes a save name for the given user. */
  checkSaveName(username: string, name: string): MatchConfigurationSaveNameCheckResult;

  /** Returns all saves belonging to the given user, newest first. */
  listSavedConfigurations(username: string): SavedMatchConfigurationEntry[];

  /** Returns all saves across all users — admin/debug use only. */
  listAllSavedConfigurations(): SavedMatchConfigurationEntry[];

  /** Persists a configuration under the given name for the given user. */
  saveConfiguration(username: string, name: string, configuration: MatchConfiguration): MatchConfigurationSaveResult;

  /** Returns the raw configuration for a saved key. */
  loadConfiguration(
    username: string,
    key: string,
  ): { ok: true; key: string; configuration: MatchConfiguration } | { ok: false; key: string; message: string };

  /** Returns a save entry with metadata and configuration. */
  getSavedConfiguration(
    username: string,
    key: string,
  ):
    | { ok: true; entry: SavedMatchConfigurationEntry; configuration: MatchConfiguration }
    | { ok: false; key: string; message: string };

  /** Replaces the configuration for an existing save, optionally renaming it. */
  updateConfiguration(
    username: string,
    key: string,
    configuration: MatchConfiguration,
    requestedName?: string,
  ): { ok: true; key: string; name: string } | { ok: false; key: string; message: string };

  /** Deletes one save for the given user. */
  deleteConfiguration(username: string, key: string): { ok: true; key: string } | { ok: false; key: string; message: string };

  /**
   * Deletes saves. When `username` is provided, deletes only that user's saves.
   * When omitted, deletes all saves across all users (admin/debug use).
   */
  deleteAllConfigurations(username?: string): { ok: true; removed: number } | { ok: false; removed: number; message: string };
}
