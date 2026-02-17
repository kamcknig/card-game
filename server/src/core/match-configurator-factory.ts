import { MatchConfiguration } from 'shared/types/index.ts';
import { MatchConfigurator } from './match-configurator.ts';
import { asValue, AwilixContainer } from 'awilix';
import { InitializeExpansionContext } from '@server-types/index.ts';

// Factory wrapper for creating match configurators from the root DI graph.
export class MatchConfiguratorFactory {
  constructor(
    private readonly rootContainer: AwilixContainer,
  ) {}

  public create(config: MatchConfiguration, initContext: InitializeExpansionContext): MatchConfigurator {
    // Resolve configurator from a scope so runtime values stay isolated per initialize() call.
    const scope = this.rootContainer.createScope();

    scope.register({
      config: asValue(config),
      initContext: asValue(initContext),
    });

    return scope.resolve<MatchConfigurator>('matchConfigurator');
  }
}
