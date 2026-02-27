import { createCardLike } from '../../utils/create-card-data.ts';
import { ProphecyNoId } from 'shared/types/index.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';

// Loads prophecy data for one expansion.
export class ProphecyLoaderService {
  constructor(
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly loggerService: LoggerService,
  ) {}

  // Loads prophecy libraries for one expansion when present.
  public async loadExpansionProphecies(expansionName: string): Promise<void> {
    const expansionProphecies = (this.expansionCatalogService.getRequiredExpansion(expansionName).prophecies ??= {});

    try {
      const prophecyLibraryModule = await import(
        `@expansions/${expansionName}/prophecy-library-${expansionName}.json`,
        { with: { type: 'json' } }
      );
      const prophecies = prophecyLibraryModule.default as Record<string, Partial<ProphecyNoId>>;

      for (const cardKey of Object.keys(prophecies)) {
        const prophecyTemplate = prophecies[cardKey];
        const cardLike = createCardLike(cardKey, expansionName, prophecyTemplate);
        expansionProphecies[cardKey] = {
          ...cardLike,
          randomizer: prophecyTemplate.randomizer ?? null,
        };
      }
    } catch (error) {
      if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(
          `[load-prophecies] failed to load expansion prophecy library for expansion ${expansionName}`,
        );
        this.loggerService.error(error);
      }
    }
  }
}
