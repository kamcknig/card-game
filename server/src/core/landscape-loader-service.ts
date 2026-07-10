import { createCardLike } from '../utils/create-card-data.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { CardKey, CardLikeNoId } from 'shared/types/index.ts';
import { ExpansionEffectKind, ExpansionEffectRegistryService } from './expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from './expansion-catalog-service.ts';
import { LoggerService } from './logger-service.ts';

// Every landscape kind this loader supports. Doubles as the file-name prefix
// for `<kind>-library-<expansion>.json` and (when `hasEffects`) the
// companion `<kind>-effects-<expansion>.ts` module.
export type LandscapeLoaderKind = 'event' | 'landmark' | 'project' | 'way' | 'ally' | 'prophecy' | 'trait';

// The subset of ExpansionData properties this loader can populate.
type LandscapeCatalogSlot = 'events' | 'landmarks' | 'projects' | 'ways' | 'allies' | 'prophecies' | 'traits';

// A landscape entry shape common to every kind this loader supports.
type LandscapeNoId = CardLikeNoId & { randomizer?: string | null };

/**
 * Per-kind configuration for {@link LandscapeLoaderService}.
 *
 * One instance of this config is built per landscape kind in
 * register-root-services.ts; the loader itself is entirely generic.
 */
export type LandscapeLoaderConfig<TNoId extends LandscapeNoId> = {
  // File-name prefix and effect-registry kind (for kinds with effects).
  kind: LandscapeLoaderKind;
  // Property on ExpansionData this loader reads/writes.
  catalogSlot: LandscapeCatalogSlot;
  // Human-readable label used in log messages (e.g. 'event', 'way').
  label: string;
  // Log tag prefix, matching each kind's historical `[load-<kind>s]` tag
  // (irregular plurals — 'ally' -> 'allies', 'prophecy' -> 'prophecies' —
  // mean this can't be mechanically derived from `kind`).
  logTag: string;
  // Whether this landscape kind supports a companion effects module
  // registered through ExpansionEffectRegistryService. Allies, prophecies,
  // and traits have no such module today.
  hasEffects: boolean;
  // Extra per-entry fields merged onto the built card-like data (e.g. traits
  // set `pileKey: null`).
  extraFields?: (template: Partial<TNoId>) => Partial<TNoId>;
};

/**
 * Loads one landscape kind's library JSON and (optionally) its effects
 * module for an expansion.
 *
 * Replaces seven near-identical per-kind loader classes (EventLoaderService,
 * LandmarkLoaderService, ProjectLoaderService, WayLoaderService,
 * AllyLoaderService, ProphecyLoaderService, TraitLoaderService); one
 * instance per kind is constructed in register-root-services.ts with a
 * `LandscapeLoaderConfig`.
 *
 * Defined in: server/src/core/landscape-loader-service.ts
 * Consumers: ExpansionLoaderService (via the seven per-kind DI tokens).
 */
export class LandscapeLoaderService<TNoId extends LandscapeNoId> {
  constructor(
    private readonly expansionEffectRegistryService: ExpansionEffectRegistryService,
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly loggerService: LoggerService,
    private readonly config: LandscapeLoaderConfig<TNoId>,
  ) {}

  // Loads this kind's library and (when configured) effects module for one expansion.
  public async loadExpansionLandscapes(expansionName: string): Promise<void> {
    const { kind, catalogSlot, label, logTag, hasEffects, extraFields } = this.config;
    const expansionEntry = this.expansionCatalogService.getRequiredExpansion(expansionName);
    // Each catalog slot has a distinct static type on ExpansionData (EventNoId,
    // LandmarkNoId, ...); this loader is generic over TNoId and resolves the
    // slot by name at runtime, so the cast is required here.
    const catalogContainer = expansionEntry as unknown as Record<LandscapeCatalogSlot, Record<CardKey, TNoId>>;
    const catalog = (catalogContainer[catalogSlot] ??= {} as Record<CardKey, TNoId>);

    try {
      // Load this kind's landscape library JSON for the expansion when present.
      const libraryModule = await import(`@expansions/${expansionName}/${kind}-library-${expansionName}.json`, {
        with: { type: 'json' },
      });
      const entries = libraryModule.default as Record<string, Partial<TNoId>>;

      for (const cardKey of Object.keys(entries)) {
        // Build landscape data using shared image naming rules.
        const template = entries[cardKey];
        const cardLike = createCardLike(cardKey as CardKey, expansionName, template);
        catalog[cardKey as CardKey] = {
          ...cardLike,
          randomizer: template.randomizer ?? null,
          ...(extraFields ? extraFields(template) : {}),
        } as TNoId;
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(`[${logTag}] failed to load expansion ${label} library for expansion ${expansionName}`);
        this.loggerService.error(error);
      }
    }

    if (!hasEffects) {
      // Allies, prophecies, and traits have no companion effects module.
      return;
    }

    try {
      // Register this kind's effects if the expansion provides them.
      const effectsModule = await import(`@expansions/${expansionName}/${kind}-effects-${expansionName}.ts`);
      const effects = effectsModule.default as CardExpansionModule;
      const effectKind = kind as ExpansionEffectKind;

      for (const cardKey of Object.keys(effects)) {
        if (!effects[cardKey].registerEffects) continue;

        // Only warn about overwriting when a registration is actually about
        // to happen — warning unconditionally whenever a same-named factory
        // already existed (even for entries with no `registerEffects` of
        // their own) was the historical bug in every per-kind loader.
        if (this.expansionEffectRegistryService.has(effectKind, cardKey as CardKey)) {
          this.loggerService.warn(`[${logTag}] ${label} key ${cardKey} already exists in ${label} registry, overwriting`);
        }

        this.loggerService.info(`[${logTag}] registering ${label} effects for ${cardKey}`);
        this.expansionEffectRegistryService.register(effectKind, cardKey as CardKey, effects[cardKey].registerEffects);
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(`[${logTag}] failed to load expansion ${label} effects for expansion ${expansionName}`);
        this.loggerService.error(error);
      }
    }
  }
}
