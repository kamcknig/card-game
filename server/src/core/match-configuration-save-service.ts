import {
  MatchConfiguration,
  MatchConfigurationSaveNameCheckResult,
  MatchConfigurationSaveResult,
  SavedMatchConfigurationEntry,
} from 'shared/types/index.ts';
import { LoggerService } from './logger-service.ts';
import { getSavedMatchConfigurationDirectory } from './game-data-paths.ts';
import type { MatchConfigurationSaveStore } from './match-configuration-save-store.ts';

type PersistedMatchConfigurationSave = {
  name: string;
  savedAtMs: number;
  configuration: MatchConfiguration;
};

/**
 * File-based implementation of {@link MatchConfigurationSaveStore}.
 *
 * Saves are written as JSON files under a per-user subdirectory:
 * `{GAME_DATA_ROOT}/saves/match-configurations/{usernameLower}/{normalizedKey}.json`
 *
 * Defined in: server/src/core/match-configuration-save-service.ts
 * Registered as `matchConfigurationSaveService` in register-root-services.ts
 * when GAME_DATA_STORE is unset or 'file'.
 */
export class MatchConfigurationSaveService implements MatchConfigurationSaveStore {
  private static readonly FILE_EXTENSION = '.json';

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Checks whether a user-provided save name is valid and available for the given user.
   *
   * Normalizes the name and checks whether a matching file already exists on disk
   * in the user's per-user save directory.
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
      exists: this.fileExists(this.getSaveFilePath(username, normalizedName)),
    };
  }

  /**
   * Returns all saved match configurations for the given user, sorted newest first.
   *
   * Reads all `.json` files from the user's per-user save directory and extracts
   * their metadata. Files that are missing or unreadable are silently skipped.
   */
  public listSavedConfigurations(username: string): SavedMatchConfigurationEntry[] {
    const saveDirectory = getSavedMatchConfigurationDirectory(username);
    try {
      const entries: SavedMatchConfigurationEntry[] = [];
      for (const entry of Deno.readDirSync(saveDirectory)) {
        if (!entry.isFile || !entry.name.toLowerCase().endsWith(MatchConfigurationSaveService.FILE_EXTENSION)) {
          continue;
        }

        const key = entry.name.slice(0, -MatchConfigurationSaveService.FILE_EXTENSION.length);
        const filePath = `${saveDirectory}/${entry.name}`;
        const saved = this.readSavedConfiguration(filePath);
        if (!saved) {
          continue;
        }

        entries.push({
          key,
          name: saved.name,
          savedAtMs: saved.savedAtMs,
        });
      }

      return entries.sort((a, b) => b.savedAtMs - a.savedAtMs || a.name.localeCompare(b.name));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return [];
      }
      this.loggerService.warn(`[match config saves] failed to list saved configurations for user '${username}'`);
      this.loggerService.error(error);
      return [];
    }
  }

  /**
   * Returns all saved configurations across all users — admin/debug use only.
   *
   * Iterates all subdirectories under the root saves directory, treating each as a
   * username, and collects entries from each user's directory.
   */
  public listAllSavedConfigurations(): SavedMatchConfigurationEntry[] {
    const rootDirectory = getSavedMatchConfigurationDirectory();
    const allEntries: SavedMatchConfigurationEntry[] = [];

    try {
      for (const dirEntry of Deno.readDirSync(rootDirectory)) {
        if (!dirEntry.isDirectory) {
          continue;
        }
        const username = dirEntry.name;
        const userEntries = this.listSavedConfigurations(username);
        allEntries.push(...userEntries);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return [];
      }
      this.loggerService.warn('[match config saves] failed to list all saved configurations');
      this.loggerService.error(error);
    }

    return allEntries.sort((a, b) => b.savedAtMs - a.savedAtMs || a.name.localeCompare(b.name));
  }

  /**
   * Persists the provided configuration under a validated save name for the given user.
   *
   * Creates the user's per-user save directory if it does not already exist, then
   * writes the configuration to a JSON file named by the normalized save key.
   */
  public saveConfiguration(username: string, name: string, configuration: MatchConfiguration): MatchConfigurationSaveResult {
    const check = this.checkSaveName(username, name);
    if (!check.isValid) {
      return {
        ok: false,
        name: name.trim(),
        message: check.reason ?? 'Invalid save name.',
      };
    }

    const saveDirectory = getSavedMatchConfigurationDirectory(username);
    const saveFilePath = this.getSaveFilePath(username, check.normalizedName);
    const trimmedName = name.trim();
    const payload: PersistedMatchConfigurationSave = {
      name: trimmedName.length > 0 ? trimmedName : check.normalizedName,
      savedAtMs: Date.now(),
      configuration: structuredClone(configuration),
    };

    try {
      Deno.mkdirSync(saveDirectory, { recursive: true });
      Deno.writeTextFileSync(saveFilePath, JSON.stringify(payload, null, 2));
      this.loggerService.info(
        `[match config saves] ${check.exists ? 'overwrote' : 'saved'} configuration '${payload.name}' for user '${username}' (${check.normalizedName})`,
      );
      return {
        ok: true,
        name: payload.name,
      };
    } catch (error) {
      this.loggerService.warn(`[match config saves] failed to save match configuration for user '${username}'`);
      this.loggerService.error(error);
      return {
        ok: false,
        name: payload.name,
        message: 'Failed to save configuration on server.',
      };
    }
  }

  /**
   * Loads one saved configuration by key for the given user.
   *
   * Returns the raw configuration without metadata. Returns a failure result when
   * the key is invalid or the file is not found.
   */
  public loadConfiguration(
    username: string,
    key: string,
  ): { ok: true; key: string; configuration: MatchConfiguration } | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return {
        ok: false,
        key,
        message: 'Invalid saved configuration key.',
      };
    }

    const saveFilePath = this.getSaveFilePath(username, normalizedKey);
    const saved = this.readSavedConfiguration(saveFilePath);
    if (!saved) {
      return {
        ok: false,
        key: normalizedKey,
        message: 'Saved configuration was not found or is unreadable.',
      };
    }

    return {
      ok: true,
      key: normalizedKey,
      configuration: structuredClone(saved.configuration),
    };
  }

  /**
   * Loads one saved configuration by key with metadata for the given user.
   *
   * Returns both the entry metadata and raw configuration, used by debug CRUD endpoints.
   * Returns a failure result when the key is invalid or the file is not found.
   */
  public getSavedConfiguration(
    username: string,
    key: string,
  ):
    | { ok: true; entry: SavedMatchConfigurationEntry; configuration: MatchConfiguration }
    | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return {
        ok: false,
        key,
        message: 'Invalid saved configuration key.',
      };
    }

    const saveFilePath = this.getSaveFilePath(username, normalizedKey);
    const saved = this.readSavedConfiguration(saveFilePath);
    if (!saved) {
      return {
        ok: false,
        key: normalizedKey,
        message: 'Saved configuration was not found or is unreadable.',
      };
    }

    return {
      ok: true,
      entry: {
        key: normalizedKey,
        name: saved.name,
        savedAtMs: saved.savedAtMs,
      },
      configuration: structuredClone(saved.configuration),
    };
  }

  /**
   * Updates one existing saved configuration by key for the given user.
   *
   * Optionally renames the save when `requestedName` is provided. Preserves the
   * existing display name when `requestedName` is empty. Returns a failure result
   * when the key is invalid or the file is not found.
   */
  public updateConfiguration(
    username: string,
    key: string,
    configuration: MatchConfiguration,
    requestedName?: string,
  ): { ok: true; key: string; name: string } | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return {
        ok: false,
        key,
        message: 'Invalid saved configuration key.',
      };
    }

    const saveFilePath = this.getSaveFilePath(username, normalizedKey);
    const existingSave = this.readSavedConfiguration(saveFilePath);
    if (!existingSave) {
      return {
        ok: false,
        key: normalizedKey,
        message: 'Saved configuration was not found or is unreadable.',
      };
    }

    const trimmedRequestedName = requestedName?.trim() ?? '';
    const resolvedName =
      trimmedRequestedName.length > 0
        ? trimmedRequestedName
        : existingSave.name.trim().length > 0
          ? existingSave.name
          : normalizedKey;

    const payload: PersistedMatchConfigurationSave = {
      name: resolvedName,
      savedAtMs: Date.now(),
      configuration: structuredClone(configuration),
    };

    try {
      Deno.mkdirSync(getSavedMatchConfigurationDirectory(username), { recursive: true });
      Deno.writeTextFileSync(saveFilePath, JSON.stringify(payload, null, 2));
      this.loggerService.info(
        `[match config saves] updated configuration '${resolvedName}' for user '${username}' (${normalizedKey})`,
      );
      return {
        ok: true,
        key: normalizedKey,
        name: resolvedName,
      };
    } catch (error) {
      this.loggerService.warn(
        `[match config saves] failed to update configuration '${normalizedKey}' for user '${username}'`,
      );
      this.loggerService.error(error);
      return {
        ok: false,
        key: normalizedKey,
        message: 'Failed to update saved configuration on server.',
      };
    }
  }

  /**
   * Deletes one saved configuration by key for the given user.
   *
   * Returns a failure result when the key is invalid or the file is not found.
   */
  public deleteConfiguration(
    username: string,
    key: string,
  ): { ok: true; key: string } | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return {
        ok: false,
        key,
        message: 'Invalid saved configuration key.',
      };
    }

    const saveFilePath = this.getSaveFilePath(username, normalizedKey);
    if (!this.fileExists(saveFilePath)) {
      return {
        ok: false,
        key: normalizedKey,
        message: 'Saved configuration was not found.',
      };
    }

    try {
      Deno.removeSync(saveFilePath);
      this.loggerService.info(`[match config saves] deleted configuration '${normalizedKey}' for user '${username}'`);
      return {
        ok: true,
        key: normalizedKey,
      };
    } catch (error) {
      this.loggerService.warn(
        `[match config saves] failed to delete configuration '${normalizedKey}' for user '${username}'`,
      );
      this.loggerService.error(error);
      return {
        ok: false,
        key: normalizedKey,
        message: 'Failed to delete saved configuration on server.',
      };
    }
  }

  /**
   * Deletes saved configurations and returns the number removed.
   *
   * When `username` is provided, deletes only that user's per-user subdirectory.
   * When omitted, iterates all subdirectories and removes each one (admin/debug use).
   */
  public deleteAllConfigurations(
    username?: string,
  ): { ok: true; removed: number } | { ok: false; removed: number; message: string } {
    // Delete only a single user's saves when username is provided.
    if (username) {
      return this.deleteUserDirectory(username);
    }

    // Delete all users' saves by iterating all subdirectories.
    const rootDirectory = getSavedMatchConfigurationDirectory();
    let totalRemoved = 0;

    try {
      for (const dirEntry of Deno.readDirSync(rootDirectory)) {
        if (!dirEntry.isDirectory) {
          continue;
        }
        const result = this.deleteUserDirectory(dirEntry.name);
        totalRemoved += result.removed;
        if (!result.ok) {
          // Log but continue to delete remaining users.
          this.loggerService.warn(
            `[match config saves] partial failure while deleting saves for user '${dirEntry.name}': ${result.message}`,
          );
        }
      }

      this.loggerService.info(`[match config saves] deleted all saved configurations (${totalRemoved} file(s))`);
      return { ok: true, removed: totalRemoved };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { ok: true, removed: 0 };
      }
      this.loggerService.warn('[match config saves] failed to delete all saved configurations');
      this.loggerService.error(error);
      return { ok: false, removed: totalRemoved, message: 'Failed to delete all saved configurations.' };
    }
  }

  /**
   * Deletes all save files in a single user's directory and removes the directory.
   *
   * Returns the count of files removed. Used internally by `deleteAllConfigurations`.
   */
  private deleteUserDirectory(username: string): { ok: true; removed: number } | { ok: false; removed: number; message: string } {
    const userDirectory = getSavedMatchConfigurationDirectory(username);
    let removedCount = 0;

    try {
      for (const entry of Deno.readDirSync(userDirectory)) {
        if (!entry.isFile || !entry.name.toLowerCase().endsWith(MatchConfigurationSaveService.FILE_EXTENSION)) {
          continue;
        }
        Deno.removeSync(`${userDirectory}/${entry.name}`);
        removedCount++;
      }

      // Remove the now-empty user directory.
      Deno.removeSync(userDirectory);
      this.loggerService.info(
        `[match config saves] deleted ${removedCount} save(s) for user '${username}'`,
      );
      return { ok: true, removed: removedCount };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { ok: true, removed: 0 };
      }
      this.loggerService.warn(`[match config saves] failed to delete saves for user '${username}'`);
      this.loggerService.error(error);
      return { ok: false, removed: removedCount, message: `Failed to delete saved configurations for user '${username}'.` };
    }
  }

  /**
   * Reads one saved configuration payload from disk.
   *
   * Returns undefined when the file is missing, empty, or contains invalid JSON.
   * Supports backward compatibility for legacy raw `MatchConfiguration` files.
   */
  private readSavedConfiguration(filePath: string): PersistedMatchConfigurationSave | undefined {
    try {
      const raw = Deno.readTextFileSync(filePath);
      if (raw.trim().length === 0) {
        this.loggerService.warn(`[match config saves] save file '${filePath}' is empty`);
        return undefined;
      }

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'configuration' in parsed) {
        const savePayload = parsed as PersistedMatchConfigurationSave;
        return {
          name: savePayload.name,
          savedAtMs: savePayload.savedAtMs,
          configuration: savePayload.configuration,
        };
      }

      // Backward compatibility for raw MatchConfiguration files.
      return {
        name: filePath.split('/').pop()?.replace(MatchConfigurationSaveService.FILE_EXTENSION, '') ?? 'configuration',
        savedAtMs: 0,
        configuration: parsed as MatchConfiguration,
      };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return undefined;
      }
      if (error instanceof SyntaxError) {
        this.loggerService.warn(`[match config saves] save file '${filePath}' contains invalid JSON`);
        return undefined;
      }
      this.loggerService.warn(`[match config saves] failed to read save file '${filePath}'`);
      this.loggerService.error(error);
      return undefined;
    }
  }

  /**
   * Builds a deterministic save-file path for a normalized save key under the user's directory.
   *
   * @param username The authenticated username (lowercased by getSavedMatchConfigurationDirectory).
   * @param normalizedName The normalized save key used as the filename stem.
   */
  private getSaveFilePath(username: string, normalizedName: string): string {
    return `${getSavedMatchConfigurationDirectory(username)}/${normalizedName}${MatchConfigurationSaveService.FILE_EXTENSION}`;
  }

  /**
   * Returns true when a save file already exists on disk at the given path.
   *
   * Uses `Deno.statSync` to avoid TOCTOU issues with reading. Any error other than
   * `NotFound` is treated as an inaccessible file (returns false with a warning log).
   */
  private fileExists(filePath: string): boolean {
    try {
      Deno.statSync(filePath);
      return true;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return false;
      }
      this.loggerService.warn(`[match config saves] failed to stat save file '${filePath}'`);
      this.loggerService.error(error);
      return false;
    }
  }

  /**
   * Normalizes user-provided save names into safe filesystem keys.
   *
   * Trims whitespace, replaces spaces with hyphens, removes non-alphanumeric characters
   * (except hyphens and underscores), and truncates to 64 characters.
   */
  private normalizeSaveName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 64);
  }
}
