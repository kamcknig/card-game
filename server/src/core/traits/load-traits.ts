import { TraitNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';
import { LandscapeLoaderService } from '../landscape-loader-service.ts';

// Loads trait data for one expansion.
export class TraitLoaderService extends LandscapeLoaderService<TraitNoId> {
  constructor(
    expansionEffectRegistryService: ExpansionEffectRegistryService,
    expansionCatalogService: ExpansionCatalogService,
    loggerService: LoggerService,
  ) {
    super(expansionEffectRegistryService, expansionCatalogService, loggerService, {
      kind: 'trait',
      catalogSlot: 'traits',
      label: 'trait',
      logTag: 'load-traits',
      hasEffects: false,
      // Traits are attached to a supply pile at runtime; unassigned until a
      // configurator assigns one, so it starts as null here.
      extraFields: () => ({ pileKey: null }),
    });
  }

  // Loads trait libraries for one expansion when present.
  public loadExpansionTraits(expansionName: string): Promise<void> {
    return this.loadExpansionLandscapes(expansionName);
  }
}
