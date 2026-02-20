import { createCardLike } from '../../utils/create-card-data.ts';
import { AllyNoId } from 'shared/types/index.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';

// Loads ally data for one expansion.
export class AllyLoaderService {
  constructor(
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly loggerService: LoggerService,
  ) {}

  // Loads ally libraries for one expansion when present.
  public async loadExpansionAllies(expansionName: string): Promise<void> {
    const expansionAllies = (this.expansionCatalogService.getRequiredExpansion(expansionName).allies ??= {});

    try {
      const allyLibraryModule = await import(
        `@expansions/${expansionName}/ally-library-${expansionName}.json`,
        { with: { type: 'json' } },
      );
      const allies = allyLibraryModule.default as Record<string, Partial<AllyNoId>>;

      for (const cardKey of Object.keys(allies)) {
        const allyTemplate = allies[cardKey];
        const cardLike = createCardLike(cardKey, expansionName, allyTemplate);
        expansionAllies[cardKey] = {
          ...cardLike,
          randomizer: allyTemplate.randomizer ?? null,
        };
      }
    } catch (error) {
      if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(`[load-allies] failed to load expansion ally library for expansion ${expansionName}`);
        this.loggerService.error(error);
      }
    }
  }
}
