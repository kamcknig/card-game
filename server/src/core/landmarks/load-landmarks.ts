import { createCardLike } from '../../utils/create-card-data.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { CardKey, LandmarkNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';

export const loadLandmarks = async (
  expansionName: string,
  expansionEffectRegistryService: ExpansionEffectRegistryService,
  expansionCatalogService: ExpansionCatalogService,
) => {
  const expansionLandmarks = (expansionCatalogService.getRequiredExpansion(expansionName).landmarks ??= {});

  try {
    // Load the landmark library JSON for the expansion when present.
    const landmarkLibraryModule = await import(
      `@expansions/${expansionName}/landmark-library-${expansionName}.json`,
      { with: { type: 'json' } }
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
      console.warn(
        `[load-landmarks] failed to load expansion landmark library for expansion ${expansionName}`,
      );
      console.error(error);
    }
  }

  try {
    // Register landmark effects if the expansion provides them.
    const landmarkModule = await import(
      `@expansions/${expansionName}/landmark-effects-${expansionName}.ts`
    );
    const landmarks = landmarkModule.default as CardExpansionModule;

    for (const cardKey of Object.keys(landmarks)) {
      if (expansionEffectRegistryService.hasLandmarkEffectFactory(cardKey as CardKey)) {
        console.warn(
          `[load-landmarks] landmark key ${cardKey} already exists in landmark registry, overwriting`,
        );
      }

      if (landmarks[cardKey].registerEffects) {
        // Landmarks currently reuse card effect factories for future expansion support.
        console.info(
          `[load-landmarks] registering landmark effects for ${cardKey}`,
        );
        expansionEffectRegistryService.registerLandmarkEffectFactory(
          cardKey as CardKey,
          landmarks[cardKey].registerEffects,
        );
      }
    }
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(
        `[load-landmarks] failed to load expansion landmark effects for expansion ${expansionName}`,
      );
      console.error(error);
    }
  }
};
