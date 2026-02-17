import { AppSocket } from '@server-types/index.ts';
import { PlayerId } from 'shared/types/index.ts';
import { asClass, asValue, AwilixContainer, createContainer, InjectionMode } from 'awilix';
import { CardSourceController } from './card-source-controller.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { MatchConfiguratorFactory } from './match-configurator-factory.ts';
import { MatchController } from './match-controller.ts';
import { MatchRuntimeFactory } from './match-runtime-factory.ts';
import { createInitialMatchState } from './match-state-factory.ts';

export interface MatchScope {
  matchController: MatchController;
  dispose: () => void;
}

// Builds the per-match scope and resolves match-lifetime services/controllers.
export class MatchScopeFactory {
  constructor(
    private readonly matchRuntimeFactory: MatchRuntimeFactory,
    private readonly matchConfiguratorFactory: MatchConfiguratorFactory,
  ) {}

  public create(socketMap: Map<PlayerId, AppSocket>): MatchScope {
    const match = createInitialMatchState();
    const cardLibrary = new MatchCardLibrary();

    // Scope owns match-lifetime dependencies and instances.
    const scope: AwilixContainer = createContainer({
      injectionMode: InjectionMode.CLASSIC,
    });

    scope.register({
      socketMap: asValue(socketMap),
      matchRuntimeFactory: asValue(this.matchRuntimeFactory),
      matchConfiguratorFactory: asValue(this.matchConfiguratorFactory),
      match: asValue(match),
      cardLibrary: asValue(cardLibrary),
      cardSourceController: asClass(CardSourceController).singleton(),
      matchController: asClass(MatchController).singleton(),
    });

    const matchController = scope.resolve<MatchController>('matchController');

    return {
      matchController,
      dispose: () => {
        // Dispose registered resources in this match scope when the match ends/resets.
        void scope.dispose();
      },
    };
  }
}
