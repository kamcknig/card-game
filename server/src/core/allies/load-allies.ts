import { AllyNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';
import { LandscapeLoaderService } from '../landscape-loader-service.ts';

// Loads ally data for one expansion.
export class AllyLoaderService extends LandscapeLoaderService<AllyNoId> {
  constructor(
    expansionEffectRegistryService: ExpansionEffectRegistryService,
    expansionCatalogService: ExpansionCatalogService,
    loggerService: LoggerService,
  ) {
    super(expansionEffectRegistryService, expansionCatalogService, loggerService, {
      kind: 'ally',
      catalogSlot: 'allies',
      label: 'ally',
      logTag: 'load-allies',
      // Allies have no companion ally-effects-<expansion>.ts loader; ally
      // behavior is wired directly by expansion configurators instead.
      hasEffects: false,
    });
  }

  // Loads ally libraries for one expansion when present.
  public loadExpansionAllies(expansionName: string): Promise<void> {
    return this.loadExpansionLandscapes(expansionName);
  }
}
