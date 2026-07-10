import { WayNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';
import { LandscapeLoaderService } from '../landscape-loader-service.ts';

// Loads way data and effect factories for an expansion.
export class WayLoaderService extends LandscapeLoaderService<WayNoId> {
  constructor(
    expansionEffectRegistryService: ExpansionEffectRegistryService,
    expansionCatalogService: ExpansionCatalogService,
    loggerService: LoggerService,
  ) {
    super(expansionEffectRegistryService, expansionCatalogService, loggerService, {
      kind: 'way',
      catalogSlot: 'ways',
      label: 'way',
      logTag: 'load-ways',
      hasEffects: true,
    });
  }

  // Loads way libraries and way effects for one expansion.
  public loadExpansionWays(expansionName: string): Promise<void> {
    return this.loadExpansionLandscapes(expansionName);
  }
}
