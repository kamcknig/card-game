import { createCardLike } from '../../utils/create-card-data.ts';
import { TraitNoId } from 'shared/types/index.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';

// Loads trait data for one expansion.
export class TraitLoaderService {
  constructor(
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly loggerService: LoggerService,
  ) {}

  // Loads trait libraries for one expansion when present.
  public async loadExpansionTraits(expansionName: string): Promise<void> {
    const expansionTraits = (this.expansionCatalogService.getRequiredExpansion(expansionName).traits ??= {});

    try {
      const traitLibraryModule = await import(`@expansions/${expansionName}/trait-library-${expansionName}.json`, {
        with: { type: 'json' },
      });
      const traits = traitLibraryModule.default as Record<string, Partial<TraitNoId>>;

      for (const cardKey of Object.keys(traits)) {
        const traitTemplate = traits[cardKey];
        const cardLike = createCardLike(cardKey, expansionName, traitTemplate);
        expansionTraits[cardKey] = {
          ...cardLike,
          randomizer: traitTemplate.randomizer ?? null,
          pileKey: null,
        };
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(`[load-traits] failed to load expansion trait library for expansion ${expansionName}`);
        this.loggerService.error(error);
      }
    }
  }
}
