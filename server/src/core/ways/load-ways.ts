import { createCardLike } from '../../utils/create-card-data.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { CardKey, WayNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';

// Loads way data and effect factories for an expansion.
export class WayLoaderService {
  constructor(
    private readonly expansionEffectRegistryService: ExpansionEffectRegistryService,
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly loggerService: LoggerService,
  ) {}

  // Loads way libraries and way effects for one expansion.
  public async loadExpansionWays(expansionName: string): Promise<void> {
    const expansionWays = (this.expansionCatalogService.getRequiredExpansion(expansionName).ways ??= {});

    try {
      // Load the way library JSON for the expansion when present.
      const wayLibraryModule = await import(
        `@expansions/${expansionName}/way-library-${expansionName}.json`,
        { with: { type: 'json' } },
      );
      const ways = wayLibraryModule.default as Record<string, Partial<WayNoId>>;

      for (const cardKey of Object.keys(ways)) {
        // Build way landscape data using shared image naming rules.
        const wayTemplate = ways[cardKey];
        const cardLike = createCardLike(cardKey, expansionName, wayTemplate);
        expansionWays[cardKey] = {
          ...cardLike,
          randomizer: wayTemplate.randomizer ?? null,
        };
      }
    } catch (error) {
      if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(
          `[load-ways] failed to load expansion way library for expansion ${expansionName}`,
        );
        this.loggerService.error(error);
      }
    }

    try {
      // Register way effects if the expansion provides them.
      const wayModule = await import(`@expansions/${expansionName}/way-effects-${expansionName}.ts`);
      const ways = wayModule.default as CardExpansionModule;

      for (const cardKey of Object.keys(ways)) {
        if (this.expansionEffectRegistryService.hasWayEffectFactory(cardKey as CardKey)) {
          this.loggerService.warn(
            `[load-ways] way key ${cardKey} already exists in way registry, overwriting`,
          );
        }

        if (ways[cardKey].registerEffects) {
          this.loggerService.info(
            `[load-ways] registering way effects for ${cardKey}`,
          );
          this.expansionEffectRegistryService.registerWayEffectFactory(
            cardKey as CardKey,
            ways[cardKey].registerEffects,
          );
        }
      }
    } catch (error) {
      if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(
          `[load-ways] failed to load expansion way effects for expansion ${expansionName}`,
        );
        this.loggerService.error(error);
      }
    }
  }
}
