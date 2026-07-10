import { LandmarkNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';
import { LandscapeLoaderService } from '../landscape-loader-service.ts';

// Loads landmark data and effect factories for an expansion.
export class LandmarkLoaderService extends LandscapeLoaderService<LandmarkNoId> {
  constructor(
    expansionEffectRegistryService: ExpansionEffectRegistryService,
    expansionCatalogService: ExpansionCatalogService,
    loggerService: LoggerService,
  ) {
    super(expansionEffectRegistryService, expansionCatalogService, loggerService, {
      kind: 'landmark',
      catalogSlot: 'landmarks',
      label: 'landmark',
      logTag: 'load-landmarks',
      hasEffects: true,
    });
  }

  // Loads landmark libraries and landmark effects for one expansion.
  public loadExpansionLandmarks(expansionName: string): Promise<void> {
    return this.loadExpansionLandscapes(expansionName);
  }
}
