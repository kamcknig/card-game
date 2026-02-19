import {
  MatchConfiguration,
  MatchConfigurationSaveNameCheckResult,
  MatchConfigurationSaveResult,
  SavedMatchConfigurationEntry,
} from 'shared/types/index.ts';
import { LoggerService } from './logger-service.ts';
import { getSavedMatchConfigurationDirectory } from './game-data-paths.ts';

type PersistedMatchConfigurationSave = {
  name: string;
  savedAtMs: number;
  configuration: MatchConfiguration;
};

// Handles save/list/load operations for named match configurations.
export class MatchConfigurationSaveService {
  private static readonly FILE_EXTENSION = '.json';

  constructor(
    private readonly loggerService: LoggerService,
  ) {}

  // Checks whether a user-provided save name is valid and available.
  public checkSaveName(name: string): MatchConfigurationSaveNameCheckResult {
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
      exists: this.fileExists(this.getSaveFilePath(normalizedName)),
    };
  }

  // Returns all saved match configurations sorted by newest first.
  public listSavedConfigurations(): SavedMatchConfigurationEntry[] {
    const saveDirectory = getSavedMatchConfigurationDirectory();
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
      this.loggerService.warn('[match config saves] failed to list saved configurations');
      this.loggerService.error(error);
      return [];
    }
  }

  // Persists the provided configuration under a validated save name.
  public saveConfiguration(name: string, configuration: MatchConfiguration): MatchConfigurationSaveResult {
    const check = this.checkSaveName(name);
    if (!check.isValid) {
      return {
        ok: false,
        name: name.trim(),
        message: check.reason ?? 'Invalid save name.',
      };
    }

    if (check.exists) {
      return {
        ok: false,
        name: check.normalizedName,
        message: `A saved configuration named '${check.normalizedName}' already exists.`,
      };
    }

    const saveDirectory = getSavedMatchConfigurationDirectory();
    const saveFilePath = this.getSaveFilePath(check.normalizedName);
    const trimmedName = name.trim();
    const payload: PersistedMatchConfigurationSave = {
      name: trimmedName.length > 0 ? trimmedName : check.normalizedName,
      savedAtMs: Date.now(),
      configuration: structuredClone(configuration),
    };

    try {
      Deno.mkdirSync(saveDirectory, { recursive: true });
      Deno.writeTextFileSync(saveFilePath, JSON.stringify(payload, null, 2));
      this.loggerService.info(`[match config saves] saved configuration '${payload.name}' (${check.normalizedName})`);
      return {
        ok: true,
        name: payload.name,
      };
    } catch (error) {
      this.loggerService.warn('[match config saves] failed to save match configuration');
      this.loggerService.error(error);
      return {
        ok: false,
        name: payload.name,
        message: 'Failed to save configuration on server.',
      };
    }
  }

  // Loads one saved configuration by key.
  public loadConfiguration(key: string): { ok: true; key: string; configuration: MatchConfiguration }
    | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return {
        ok: false,
        key,
        message: 'Invalid saved configuration key.',
      };
    }

    const saveFilePath = this.getSaveFilePath(normalizedKey);
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

  // Loads one saved configuration by key with metadata needed by debug CRUD endpoints.
  public getSavedConfiguration(key: string):
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

    const saveFilePath = this.getSaveFilePath(normalizedKey);
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

  // Updates one existing saved configuration by key.
  public updateConfiguration(
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

    const saveFilePath = this.getSaveFilePath(normalizedKey);
    const existingSave = this.readSavedConfiguration(saveFilePath);
    if (!existingSave) {
      return {
        ok: false,
        key: normalizedKey,
        message: 'Saved configuration was not found or is unreadable.',
      };
    }

    const trimmedRequestedName = requestedName?.trim() ?? '';
    const resolvedName = trimmedRequestedName.length > 0
      ? trimmedRequestedName
      : (existingSave.name.trim().length > 0 ? existingSave.name : normalizedKey);

    const payload: PersistedMatchConfigurationSave = {
      name: resolvedName,
      savedAtMs: Date.now(),
      configuration: structuredClone(configuration),
    };

    try {
      Deno.mkdirSync(getSavedMatchConfigurationDirectory(), { recursive: true });
      Deno.writeTextFileSync(saveFilePath, JSON.stringify(payload, null, 2));
      this.loggerService.info(`[match config saves] updated configuration '${resolvedName}' (${normalizedKey})`);
      return {
        ok: true,
        key: normalizedKey,
        name: resolvedName,
      };
    } catch (error) {
      this.loggerService.warn(`[match config saves] failed to update configuration '${normalizedKey}'`);
      this.loggerService.error(error);
      return {
        ok: false,
        key: normalizedKey,
        message: 'Failed to update saved configuration on server.',
      };
    }
  }

  // Deletes one saved configuration by key.
  public deleteConfiguration(key: string):
    | { ok: true; key: string }
    | { ok: false; key: string; message: string } {
    const normalizedKey = this.normalizeSaveName(key);
    if (!normalizedKey) {
      return {
        ok: false,
        key,
        message: 'Invalid saved configuration key.',
      };
    }

    const saveFilePath = this.getSaveFilePath(normalizedKey);
    if (!this.fileExists(saveFilePath)) {
      return {
        ok: false,
        key: normalizedKey,
        message: 'Saved configuration was not found.',
      };
    }

    try {
      Deno.removeSync(saveFilePath);
      this.loggerService.info(`[match config saves] deleted configuration '${normalizedKey}'`);
      return {
        ok: true,
        key: normalizedKey,
      };
    } catch (error) {
      this.loggerService.warn(`[match config saves] failed to delete configuration '${normalizedKey}'`);
      this.loggerService.error(error);
      return {
        ok: false,
        key: normalizedKey,
        message: 'Failed to delete saved configuration on server.',
      };
    }
  }

  // Deletes all saved configurations and returns the number of files removed.
  public deleteAllConfigurations():
    | { ok: true; removed: number }
    | { ok: false; removed: number; message: string } {
    const saveDirectory = getSavedMatchConfigurationDirectory();
    let removedCount = 0;
    try {
      for (const entry of Deno.readDirSync(saveDirectory)) {
        if (!entry.isFile || !entry.name.toLowerCase().endsWith(MatchConfigurationSaveService.FILE_EXTENSION)) {
          continue;
        }

        Deno.removeSync(`${saveDirectory}/${entry.name}`);
        removedCount++;
      }

      this.loggerService.info(`[match config saves] deleted all saved configurations (${removedCount} file(s))`);
      return {
        ok: true,
        removed: removedCount,
      };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: true,
          removed: 0,
        };
      }

      this.loggerService.warn('[match config saves] failed to delete all saved configurations');
      this.loggerService.error(error);
      return {
        ok: false,
        removed: removedCount,
        message: 'Failed to delete all saved configurations.',
      };
    }
  }

  // Reads one saved configuration payload file from disk.
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

  // Builds a deterministic save-file path for a normalized save key.
  private getSaveFilePath(normalizedName: string): string {
    return `${getSavedMatchConfigurationDirectory()}/${normalizedName}${MatchConfigurationSaveService.FILE_EXTENSION}`;
  }

  // Returns true when a save file already exists on disk.
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

  // Normalizes user-provided save names into safe filename keys.
  private normalizeSaveName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 64);
  }
}
