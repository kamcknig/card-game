import { AppSocket } from '@server-types/index.ts';
import { PlayerId } from 'shared/types/index.ts';
import { MatchController } from './match-controller.ts';
import { MatchConfiguratorFactory } from './match-configurator-factory.ts';
import { MatchRuntimeFactory } from './match-runtime-factory.ts';

export class MatchControllerFactory {
  constructor(
    private readonly _matchRuntimeFactory: MatchRuntimeFactory,
    private readonly _matchConfiguratorFactory: MatchConfiguratorFactory,
  ) {}

  public create(socketMap: Map<PlayerId, AppSocket>): MatchController {
    return new MatchController(
      socketMap,
      this._matchRuntimeFactory,
      this._matchConfiguratorFactory,
    );
  }
}
