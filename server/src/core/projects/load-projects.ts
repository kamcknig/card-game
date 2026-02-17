import { createCardLike } from '../../utils/create-card-data.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { CardKey, ProjectNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';

export const loadProjects = async (
  expansionName: string,
  expansionEffectRegistryService: ExpansionEffectRegistryService,
  expansionCatalogService: ExpansionCatalogService,
) => {
  const expansionProjects = (expansionCatalogService.getRequiredExpansion(expansionName).projects ??= {});

  try {
    // Load the project library JSON for the expansion when present.
    const projectLibraryModule = await import(
      `@expansions/${expansionName}/project-library-${expansionName}.json`,
      { with: { type: 'json' } }
    );
    const projects = projectLibraryModule.default as Record<string, Partial<ProjectNoId>>;

    for (const cardKey of Object.keys(projects)) {
      // Build project card-like data using shared image naming rules.
      const projectTemplate = projects[cardKey];
      const cardLike = createCardLike(cardKey, expansionName, projectTemplate);
      expansionProjects[cardKey] = {
        ...cardLike,
        randomizer: projectTemplate.randomizer ?? null,
      };
    }
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(
        `[load-projects] failed to load expansion project library for expansion ${expansionName}`,
      );
      console.error(error);
    }
  }

  try {
    // Register project effects if the expansion provides them.
    const projectModule = await import(
      `@expansions/${expansionName}/project-effects-${expansionName}.ts`
    );
    const projects = projectModule.default as CardExpansionModule;

    for (const cardKey of Object.keys(projects)) {
      if (expansionEffectRegistryService.hasProjectEffectFactory(cardKey as CardKey)) {
        console.warn(
          `[load-projects] project key ${cardKey} already exists in project registry, overwriting`,
        );
      }

      if (projects[cardKey].registerEffects) {
        console.info(
          `[load-projects] registering project effects for ${cardKey}`,
        );
        expansionEffectRegistryService.registerProjectEffectFactory(cardKey as CardKey, projects[cardKey].registerEffects);
      }
    }
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(
        `[load-projects] failed to load expansion project effects for expansion ${expansionName}`,
      );
      console.error(error);
    }
  }
};
