import { ProjectNoId } from 'shared/types/index.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { LoggerService } from '../logger-service.ts';
import { LandscapeLoaderService } from '../landscape-loader-service.ts';

// Loads project data and effect factories for an expansion.
export class ProjectLoaderService extends LandscapeLoaderService<ProjectNoId> {
  constructor(
    expansionEffectRegistryService: ExpansionEffectRegistryService,
    expansionCatalogService: ExpansionCatalogService,
    loggerService: LoggerService,
  ) {
    super(expansionEffectRegistryService, expansionCatalogService, loggerService, {
      kind: 'project',
      catalogSlot: 'projects',
      label: 'project',
      logTag: 'load-projects',
      hasEffects: true,
    });
  }

  // Loads project libraries and project effects for one expansion.
  public loadExpansionProjects(expansionName: string): Promise<void> {
    return this.loadExpansionLandscapes(expansionName);
  }
}
