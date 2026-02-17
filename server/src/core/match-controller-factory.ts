import { AppSocket } from '@server-types/index.ts';
import { PlayerId } from 'shared/types/index.ts';
import { ExpansionSearchService } from './expansion-search-service.ts';
import { MatchController } from './match-controller.ts';
import { MatchConfiguratorFactory } from './match-configurator-factory.ts';
import { MatchRuntimeFactory } from './match-runtime-factory.ts';
import { MatchSocketBindings } from './match-socket-bindings.ts';

export class MatchControllerFactory {
  constructor(
    private readonly _expansionSearchService: ExpansionSearchService,
    private readonly _matchRuntimeFactory: MatchRuntimeFactory,
    private readonly _matchSocketBindings: MatchSocketBindings,
    private readonly _matchConfiguratorFactory: MatchConfiguratorFactory,
  ) {}

  public create(socketMap: Map<PlayerId, AppSocket>): MatchController {
    return new MatchController(
      socketMap,
      this._expansionSearchService,
      this._matchRuntimeFactory,
      this._matchSocketBindings,
      this._matchConfiguratorFactory,
    );
  }
}
