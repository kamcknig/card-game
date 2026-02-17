import { AppSocket } from '@server-types/index.ts';
import { PlayerId } from 'shared/types/index.ts';
import { ExpansionSearchService } from './expansion-search-service.ts';
import { MatchController } from './match-controller.ts';
import { MatchConfiguratorFactory } from './match-configurator-factory.ts';
import { MatchRuntimeFactory } from './match-runtime-factory.ts';
import { MatchSocketBindings } from './match-socket-bindings.ts';

export interface MatchControllerFactoryDependencies {
  expansionSearchService: ExpansionSearchService;
  matchRuntimeFactory: MatchRuntimeFactory;
  matchSocketBindings: MatchSocketBindings;
  matchConfiguratorFactory: MatchConfiguratorFactory;
}

export class MatchControllerFactory {
  private readonly expansionSearchService: ExpansionSearchService;
  private readonly matchRuntimeFactory: MatchRuntimeFactory;
  private readonly matchSocketBindings: MatchSocketBindings;
  private readonly matchConfiguratorFactory: MatchConfiguratorFactory;

  constructor({
    expansionSearchService,
    matchRuntimeFactory,
    matchSocketBindings,
    matchConfiguratorFactory,
  }: MatchControllerFactoryDependencies) {
    this.expansionSearchService = expansionSearchService;
    this.matchRuntimeFactory = matchRuntimeFactory;
    this.matchSocketBindings = matchSocketBindings;
    this.matchConfiguratorFactory = matchConfiguratorFactory;
  }

  public create(socketMap: Map<PlayerId, AppSocket>): MatchController {
    return new MatchController({
      socketMap,
      expansionSearchService: this.expansionSearchService,
      matchRuntimeFactory: this.matchRuntimeFactory,
      matchSocketBindings: this.matchSocketBindings,
      matchConfiguratorFactory: this.matchConfiguratorFactory,
    });
  }
}
