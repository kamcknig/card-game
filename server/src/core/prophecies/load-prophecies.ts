import { ProphecyNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';
import { LandscapeLoaderService } from '../landscape-loader-service.ts';

// Loads prophecy data for one expansion.
export class ProphecyLoaderService extends LandscapeLoaderService<ProphecyNoId> {
  constructor(
    expansionEffectRegistryService: ExpansionEffectRegistryService,
    expansionCatalogService: ExpansionCatalogService,
    loggerService: LoggerService,
  ) {
    super(expansionEffectRegistryService, expansionCatalogService, loggerService, {
      kind: 'prophecy',
      catalogSlot: 'prophecies',
      label: 'prophecy',
      logTag: 'load-prophecies',
      hasEffects: false,
    });
  }

  // Loads prophecy libraries for one expansion when present.
  public loadExpansionProphecies(expansionName: string): Promise<void> {
    return this.loadExpansionLandscapes(expansionName);
  }
}
