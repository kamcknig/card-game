import { EventNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';
import { LandscapeLoaderService } from '../landscape-loader-service.ts';

// Loads event data and effect factories for an expansion.
export class EventLoaderService extends LandscapeLoaderService<EventNoId> {
  constructor(
    expansionEffectRegistryService: ExpansionEffectRegistryService,
    expansionCatalogService: ExpansionCatalogService,
    loggerService: LoggerService,
  ) {
    super(expansionEffectRegistryService, expansionCatalogService, loggerService, {
      kind: 'event',
      catalogSlot: 'events',
      label: 'event',
      logTag: 'load-events',
      hasEffects: true,
    });
  }

  // Loads event libraries and event effects for one expansion.
  public loadExpansionEvents(expansionName: string): Promise<void> {
    return this.loadExpansionLandscapes(expansionName);
  }
}
