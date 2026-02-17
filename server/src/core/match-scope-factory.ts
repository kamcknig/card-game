import { AppSocket } from '@server-types/index.ts';
import { PlayerId } from 'shared/types/index.ts';
import { asClass, asValue, AwilixContainer, createContainer, InjectionMode } from 'awilix';
import { CardSourceController } from './card-source-controller.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { MatchConfiguratorFactory } from './match-configurator-factory.ts';
import { MatchController } from './match-controller.ts';
import { MatchRuntimeFactory } from './match-runtime-factory.ts';
import { createInitialMatchState } from './match-state-factory.ts';
import { MatchSetupService } from './match-setup-service.ts';
import { EndGamePolicyRegistryService } from './end-game-policy-registry-service.ts';
import { CardInstanceFactoryService } from './card-instance-factory-service.ts';
import { MatchEndService } from './match-end-service.ts';
import { RuntimeActionGateway } from './runtime-action-gateway.ts';

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

    // Scope owns match-lifetime dependencies and instances.
    const scope: AwilixContainer = createContainer({
      injectionMode: InjectionMode.CLASSIC,
    });

    scope.register({
      socketMap: asValue(socketMap),
      matchConfiguratorFactory: asValue(this.matchConfiguratorFactory),
      match: asValue(match),
      // Resolve card library from the match scope to avoid manual construction.
      cardLibrary: asClass(MatchCardLibrary).singleton(),
      cardSourceController: asClass(CardSourceController).singleton(),
      cardInstanceFactoryService: asClass(CardInstanceFactoryService).singleton(),
      runtimeActionGateway: asClass(RuntimeActionGateway).singleton(),
      endGamePolicyRegistryService: asClass(EndGamePolicyRegistryService).singleton(),
      matchSetupService: asClass(MatchSetupService).singleton(),
      matchEndService: asClass(MatchEndService).singleton(),
      matchController: asClass(MatchController).singleton(),
    });

    this.matchRuntimeFactory.register(scope);

    const matchController = scope.resolve<MatchController>('matchController');
    const runtimeActionGateway = scope.resolve<RuntimeActionGateway>('runtimeActionGateway');
    // Bind runtime action delegation after MatchController is fully resolved.
    runtimeActionGateway.bind((action, ...args) => matchController.runGameAction(action, ...args));

    return {
      matchController,
      dispose: () => {
        // Dispose registered resources in this match scope when the match ends/resets.
        void scope.dispose();
      },
    };
  }
}
