import { MatchConfiguration } from 'shared/types/index.ts';
import { MatchConfigurator } from './match-configurator.ts';
import { asClass, asValue, createContainer, InjectionMode } from 'awilix';
import { InitializeExpansionContext } from '@server-types/index.ts';

// Factory wrapper for creating match configurators through DI instead of direct construction.
export class MatchConfiguratorFactory {
  public create(config: MatchConfiguration, initContext: InitializeExpansionContext): MatchConfigurator {
    // Create a short-lived scope so the configurator and its runtime input are both DI-resolved.
    const scope = createContainer({
      injectionMode: InjectionMode.CLASSIC,
    });

    scope.register({
      config: asValue(config),
      initContext: asValue(initContext),
      matchConfigurator: asClass(MatchConfigurator).scoped(),
    });

    return scope.resolve<MatchConfigurator>('matchConfigurator');
  }
}
