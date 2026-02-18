import { createCardLike } from '../../utils/create-card-data.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { CardKey, EventNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';

// Loads event data and effect factories for an expansion.
export class EventLoaderService {
  constructor(
    private readonly expansionEffectRegistryService: ExpansionEffectRegistryService,
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly loggerService: LoggerService,
  ) {}

  // Loads event libraries and event effects for one expansion.
  public async loadExpansionEvents(expansionName: string): Promise<void> {
    const expansionEvents = (this.expansionCatalogService.getRequiredExpansion(expansionName).events ??= {});

    try {
      const eventLibraryModule = await import(`@expansions/${expansionName}/event-library-${expansionName}.json`, {
        with: { type: 'json' },
      });
      const events = eventLibraryModule.default as Record<string, Partial<EventNoId>>;

      for (const cardKey of Object.keys(events)) {
        const eventTemplate = events[cardKey];
        const cardLike = createCardLike(cardKey, expansionName, eventTemplate);
        expansionEvents[cardKey] = {
          ...cardLike,
          randomizer: eventTemplate.randomizer ?? null,
        };
      }
    } catch (error) {
      if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(`[load-events] failed to load expansion event library for expansion ${expansionName}`);
        this.loggerService.error(error);
      }
    }

    try {
      const eventModule = await import(`@expansions/${expansionName}/event-effects-${expansionName}.ts`);
      const events = eventModule.default as CardExpansionModule;

      for (const cardKey of Object.keys(events)) {
        if (this.expansionEffectRegistryService.hasEventEffectFactory(cardKey as CardKey)) {
          this.loggerService.warn(`[load-events] card key ${cardKey} already exists in event registry, overwriting`);
        }

        if (events[cardKey].registerEffects) {
          this.loggerService.info(`[load-events] registering event effects for ${cardKey}`);
          this.expansionEffectRegistryService.registerEventEffectFactory(cardKey as CardKey, events[cardKey].registerEffects);
        }
      }
    } catch (error) {
      if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(`[load-events] failed to load expansion event effects for expansion ${expansionName}`);
        this.loggerService.error(error);
      }
    }
  }
}
