import { MatchConfiguration } from 'shared/types/index.ts';
import { MatchConfigurator } from './match-configurator.ts';
import { InitializeExpansionContext } from '@server-types/index.ts';
import { ExpansionCatalogService } from './expansion-catalog-service.ts';
import { RngService } from './rng-service.ts';
import { ServerConfigService } from './server-config-service.ts';
import { LoggerService } from './logger-service.ts';

/**
 * Factory for `MatchConfigurator` instances.
 *
 * Why this exists:
 * `MatchConfigurator` is intentionally transient and stateful per initialize call.
 * This factory injects long-lived shared services and creates a fresh configurator for each
 * configuration run so state does not leak across matches.
 */
export class MatchConfiguratorFactory {
  constructor(
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly rngService: RngService,
    private readonly serverConfigService: ServerConfigService,
    private readonly loggerService: LoggerService,
  ) {
  }

  /**
   * Creates a fresh configurator for a single match configuration pass.
   *
   * @param config Base match configuration from lobby/persistence.
   * @param initContext Callback/registrar context used by expansion configurators.
   */
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
