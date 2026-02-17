import { MatchConfiguration } from 'shared/types/index.ts';
import { MatchConfigurator } from './match-configurator.ts';
import { asClass, asValue, createContainer, InjectionMode } from 'awilix';

// Factory wrapper for creating match configurators through DI instead of direct construction.
export class MatchConfiguratorFactory {
  public create(config: MatchConfiguration): MatchConfigurator {
    // Create a short-lived scope so the configurator and its runtime input are both DI-resolved.
    const scope = createContainer({
      injectionMode: InjectionMode.CLASSIC,
    });

    scope.register({
      config: asValue(config),
      matchConfigurator: asClass(MatchConfigurator).scoped(),
    });

    return scope.resolve<MatchConfigurator>('matchConfigurator');
  }
}
