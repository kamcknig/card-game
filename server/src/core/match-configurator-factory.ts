import { MatchConfiguration } from 'shared/types/index.ts';
import { MatchConfigurator } from './match-configurator.ts';

// Factory wrapper for creating match configurators through DI instead of direct construction.
export class MatchConfiguratorFactory {
  public create(config: MatchConfiguration): MatchConfigurator {
    return new MatchConfigurator(config);
  }
}
