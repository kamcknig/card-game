import { createCardLike } from '../../utils/create-card-data.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { CardKey, LandmarkNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';

// Loads landmark data and effect factories for an expansion.
export class LandmarkLoaderService {
  constructor(
    private readonly expansionEffectRegistryService: ExpansionEffectRegistryService,
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly loggerService: LoggerService,
  ) {}

  // Loads landmark libraries and landmark effects for one expansion.
  public async loadExpansionLandmarks(expansionName: string): Promise<void> {
    const expansionLandmarks = (this.expansionCatalogService.getRequiredExpansion(expansionName).landmarks ??= {});

    try {
      // Load the landmark library JSON for the expansion when present.
      const landmarkLibraryModule = await import(
        `@expansions/${expansionName}/landmark-library-${expansionName}.json`,
        { with: { type: 'json' } },
      );
      const landmarks = landmarkLibraryModule.default as Record<string, Partial<LandmarkNoId>>;

      for (const cardKey of Object.keys(landmarks)) {
        // Build landmark card-like data using shared image naming rules.
        const landmarkTemplate = landmarks[cardKey];
        const cardLike = createCardLike(cardKey, expansionName, landmarkTemplate);
        expansionLandmarks[cardKey] = {
          ...cardLike,
          randomizer: landmarkTemplate.randomizer ?? null,
        };
      }
    } catch (error) {
      if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(
          `[load-landmarks] failed to load expansion landmark library for expansion ${expansionName}`,
        );
        this.loggerService.error(error);
      }
    }

    try {
      // Register landmark effects if the expansion provides them.
      const landmarkModule = await import(
        `@expansions/${expansionName}/landmark-effects-${expansionName}.ts`,
      );
      const landmarks = landmarkModule.default as CardExpansionModule;

      for (const cardKey of Object.keys(landmarks)) {
        if (this.expansionEffectRegistryService.hasLandmarkEffectFactory(cardKey as CardKey)) {
          this.loggerService.warn(
            `[load-landmarks] landmark key ${cardKey} already exists in landmark registry, overwriting`,
          );
        }

        if (landmarks[cardKey].registerEffects) {
          // Landmarks currently reuse card effect factories for future expansion support.
          this.loggerService.info(
            `[load-landmarks] registering landmark effects for ${cardKey}`,
          );
          this.expansionEffectRegistryService.registerLandmarkEffectFactory(
            cardKey as CardKey,
            landmarks[cardKey].registerEffects,
          );
        }
      }
    } catch (error) {
      if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
        this.loggerService.warn(
          `[load-landmarks] failed to load expansion landmark effects for expansion ${expansionName}`,
        );
        this.loggerService.error(error);
      }
    }
  }
}
