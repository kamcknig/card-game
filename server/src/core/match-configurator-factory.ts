import { MatchConfiguration } from 'shared/types/index.ts';
import { MatchConfigurator } from './match-configurator.ts';
import { InitializeExpansionContext } from '@server-types/index.ts';
import { ExpansionCatalogService } from './expansion-catalog-service.ts';
import { RngService } from './rng-service.ts';
import { ServerConfigService } from './server-config-service.ts';
import { LoggerService } from './logger-service.ts';

// Factory wrapper for creating match configurators from the root DI graph.
export class MatchConfiguratorFactory {
  constructor(
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly rngService: RngService,
    private readonly serverConfigService: ServerConfigService,
    private readonly loggerService: LoggerService,
  ) {
  }

  public create(config: MatchConfiguration, initContext: InitializeExpansionContext): MatchConfigurator {
    // MatchConfigurator is a transient value object, so construct it directly with injected stable dependencies.
    return new MatchConfigurator(
      config,
      initContext,
      this.expansionCatalogService,
      this.rngService,
      this.serverConfigService,
      this.loggerService,
    );
  }
}
