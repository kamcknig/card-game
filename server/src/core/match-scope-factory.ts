import { AppSocket, CardEffectFunctionMap } from '@server-types/index.ts';
import { PlayerId } from 'shared/types/index.ts';
import { asClass, asValue, AwilixContainer } from 'awilix';
import { CardSourceController } from './card-source-controller.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { MatchConfiguratorFactory } from './match-configurator-factory.ts';
import { MatchController } from './match-controller.ts';
import { createInitialMatchState } from './match-state-factory.ts';
import { MatchSetupService } from './match-setup-service.ts';
import { EndGamePolicyRegistryService } from './end-game-policy-registry-service.ts';
import { CardInstanceFactoryService } from './card-instance-factory-service.ts';
import { MatchEndService } from './match-end-service.ts';
import { LoggerService } from './logger-service.ts';
import { LogManager } from './log-manager.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';
import { ReactionContextFactory } from './reactions/reaction-context-factory.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { GameActionController } from './actions/game-action-controller.ts';
import { CardEffectContextFactory } from './actions/card-effect-context-factory.ts';
import { PromptService } from './prompt-service.ts';
import { FindCardsService } from './find-cards-service.ts';
import { BuyOptionsResolver } from './actions/resolve-buy-options.ts';
import { PlayOptionsResolver } from './actions/resolve-play-options.ts';
import { DefaultSupplyGainService } from './supply-gain-service.ts';
import { EndGameEvaluatorService } from './end-game-evaluator-service.ts';
import { PlayerReconnectOrchestrator } from './player-reconnect-orchestrator.ts';
import { MatchActionRunnerRef, ScopedActionService } from './actions/scoped-action-service.ts';
import { ExpansionEffectRegistryService } from './expansion-effect-registry-service.ts';
import { PlayRulesController } from './play-rules-controller.ts';
import { MatchUndoService } from './undo/match-undo-service.ts';
import { MatchUndoVoteService } from './undo/match-undo-vote-service.ts';
import { PromptAbortRegistry } from './undo/prompt-abort-registry.ts';

/**
 * Runtime handle for one active match scope.
 *
 * - `matchController` drives match lifecycle and action execution.
 * - `dispose` releases scope-owned resources when the match ends/resets.
 */
export interface MatchScope {
  // Monotonic scope id for this game's match scope lifetime.
  matchScopeId: number;
  matchController: MatchController;
  dispose: () => void;
}

/**
 * Builds and owns per-match Awilix scopes.
 *
 * This keeps one simple entrypoint (`create({ socketMap, gameId })`) for match lifetime wiring while
 * still isolating match state/controllers from the root process container.
 */
export class MatchScopeFactory {
  private nextMatchScopeId = 1;

  constructor(
    private readonly rootContainer: AwilixContainer,
    private readonly matchConfiguratorFactory: MatchConfiguratorFactory,
    private readonly expansionEffectRegistryService: ExpansionEffectRegistryService,
  ) {}

  public create(args: { socketMap: Map<PlayerId, AppSocket>; gameId: string }): MatchScope {
    const scope = this.rootContainer.createScope();
    const { socketMap, gameId } = args;
    const match = createInitialMatchState();
    const matchScopeId = this.nextMatchScopeId++;
    const matchActionRunnerRef = new MatchActionRunnerRef();

    const cardEffectFunctionMap = this.expansionEffectRegistryService.createCardEffectFunctionMap();
    const eventEffectFunctionMap = this.expansionEffectRegistryService.createEventEffectFunctionMap();
    const projectEffectFunctionMap = this.expansionEffectRegistryService.createProjectEffectFunctionMap();
    const wayEffectFunctionMap = this.expansionEffectRegistryService.createWayEffectFunctionMap();

    // Boon effects are registered per-match via expansion configurators.
    const boonEffectFunctionMap = {} as CardEffectFunctionMap;
    // Hex effects are registered per-match via expansion configurators.
    const hexEffectFunctionMap = {} as CardEffectFunctionMap;
    // State effects are registered per-match via expansion configurators.
    const stateEffectFunctionMap = {} as CardEffectFunctionMap;
    // Artifact effects are registered per-match via expansion configurators.
    const artifactEffectFunctionMap = {} as CardEffectFunctionMap;

    scope.register({
      socketMap: asValue(socketMap),
      match: asValue(match),
      loggerContext: asValue({ scope: 'match', gameId, matchScopeId }),
      loggerService: asClass(LoggerService).scoped(),
      matchConfiguratorFactory: asValue(this.matchConfiguratorFactory),
      cardEffectFunctionMap: asValue(cardEffectFunctionMap),
      eventEffectFunctionMap: asValue(eventEffectFunctionMap),
      projectEffectFunctionMap: asValue(projectEffectFunctionMap),
      wayEffectFunctionMap: asValue(wayEffectFunctionMap),
      boonEffectFunctionMap: asValue(boonEffectFunctionMap),
      hexEffectFunctionMap: asValue(hexEffectFunctionMap),
      stateEffectFunctionMap: asValue(stateEffectFunctionMap),
      artifactEffectFunctionMap: asValue(artifactEffectFunctionMap),
      // Resolve card library from the match scope to avoid manual construction.
      cardLibrary: asClass(MatchCardLibrary).scoped(),
      cardSourceController: asClass(CardSourceController).scoped(),
      cardInstanceFactoryService: asClass(CardInstanceFactoryService).scoped(),
      matchActionRunnerRef: asValue(matchActionRunnerRef),
      actionService: asClass(ScopedActionService).scoped(),
      endGamePolicyRegistryService: asClass(EndGamePolicyRegistryService).scoped(),
      matchSetupService: asClass(MatchSetupService).scoped(),
      matchEndService: asClass(MatchEndService).scoped(),
      logManager: asClass(LogManager).scoped(),
      cardPriceController: asClass(CardPriceRulesController).scoped(),
      playRulesController: asClass(PlayRulesController).scoped(),
      findCardService: asClass(FindCardsService).scoped(),
      supplyGainService: asClass(DefaultSupplyGainService).scoped(),
      promptService: asClass(PromptService).scoped(),
      cardEffectContextFactory: asClass(CardEffectContextFactory).scoped(),
      buyOptionsResolver: asClass(BuyOptionsResolver).scoped(),
      playOptionsResolver: asClass(PlayOptionsResolver).scoped(),
      reactionContextFactory: asClass(ReactionContextFactory).scoped(),
      reactionManager: asClass(ReactionManager).scoped(),
      promptAbortRegistry: asClass(PromptAbortRegistry).scoped(),
      undoService: asClass(MatchUndoService).scoped(),
      undoVoteService: asClass(MatchUndoVoteService).scoped(),
      endGameEvaluator: asClass(EndGameEvaluatorService).scoped(),
      interactivityController: asClass(CardInteractivityController).scoped(),
      playerReconnectOrchestrator: asClass(PlayerReconnectOrchestrator).scoped(),
      gameActionsController: asClass(GameActionController).scoped(),
      matchController: asClass(MatchController).scoped(),
    });

    const matchController = scope.resolve<MatchController>('matchController');
    const undoVoteService = scope.resolve<MatchUndoVoteService>('undoVoteService');

    // Bind action-service calls to this match controller once the graph is fully resolved.
    matchActionRunnerRef.bind(matchController.runGameAction.bind(matchController));

    // Bind MatchController methods onto the vote service post-resolution to break
    // the circular DI dependency (MatchController ↔ MatchUndoVoteService).
    undoVoteService.bindControllerMethods(
      matchController.getMatchSnapshot.bind(matchController),
      matchController.broadcastPatch.bind(matchController),
      // Expose the private _gameEnding flag via a closure without adding a public accessor.
      () => (matchController as unknown as { _gameEnding: boolean })._gameEnding,
      matchController.broadcastCanUndo.bind(matchController),
    );

    return {
      matchScopeId,
      matchController,
      dispose: () => {
        // Dispose registered resources in this match scope when the match ends/resets.
        void scope.dispose();
      },
    };
  }
}
