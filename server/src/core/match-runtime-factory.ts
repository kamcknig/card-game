import {Match, PlayerId} from 'shared/types/index.ts';
import {AppSocket, CardEffectFunctionMap, FindCardService, SupplyGainService} from '@server-types/index.ts';
import {LogManager} from './log-manager.ts';
import {CardPriceRulesController} from './card-price-rules-controller.ts';
import {ReactionManager} from './reactions/reaction-manager.ts';
import {cardEffectFunctionMapFactory} from './effects/card-effect-function-map-factory.ts';
import {eventEffectFactoryMap} from './events/event-effect-factory-map.ts';
import {projectEffectFactoryMap} from './projects/project-effect-factory-map.ts';
import {CardInteractivityController} from './card-interactivity-controller.ts';
import {GameActionController} from './actions/game-action-controller.ts';
import {CardSourceController} from './card-source-controller.ts';
import {MatchCardLibrary} from './match-card-library.ts';
import {asClass, asValue, createContainer, InjectionMode} from 'awilix';
import {FindCardsService} from './find-cards-service.ts';
import {BuyOptionsResolver} from './actions/resolve-buy-options.ts';
import {DefaultSupplyGainService} from './supply-gain-service.ts';
import {EndGameEvaluatorService} from './end-game-evaluator-service.ts';
import {PlayerReconnectOrchestrator} from './player-reconnect-orchestrator.ts';
import {ExpansionSearchService} from './expansion-search-service.ts';
import {MatchSocketBindings} from './match-socket-bindings.ts';
import {EndGamePolicyRegistryService} from './end-game-policy-registry-service.ts';
import {CardInstanceFactoryService} from './card-instance-factory-service.ts';

export interface MatchRuntimeFactoryArgs {
  socketMap: Map<PlayerId, AppSocket>;
  match: Match;
  cardLibrary: MatchCardLibrary;
  cardSourceController: CardSourceController;
  cardInstanceFactoryService: CardInstanceFactoryService;
  endGamePolicyRegistryService: EndGamePolicyRegistryService;
  runGameActionDelegate: <K extends string>(action: K, ...args: unknown[]) => Promise<unknown>;
}

export interface MatchRuntime {
  logManager: LogManager;
  cardPriceController: CardPriceRulesController;
  findCardService: FindCardService;
  supplyGainService: SupplyGainService;
  endGameEvaluator: EndGameEvaluatorService;
  reactionManager: ReactionManager;
  interactivityController: CardInteractivityController;
  playerReconnectOrchestrator: PlayerReconnectOrchestrator;
  gameActionsController: GameActionController;
}

// Builds the per-match runtime graph (controllers/managers/maps) used by MatchController.
export class MatchRuntimeFactory {
  constructor(
    private readonly expansionSearchService: ExpansionSearchService,
    private readonly matchSocketBindings: MatchSocketBindings,
  ) {}

  public create({
    socketMap,
    match,
    cardLibrary,
    cardSourceController,
    cardInstanceFactoryService,
    endGamePolicyRegistryService,
    runGameActionDelegate,
  }: MatchRuntimeFactoryArgs): MatchRuntime {
    const cardEffectFunctionMap = Object.keys(cardEffectFunctionMapFactory).reduce((acc, nextKey) => {
      acc[nextKey] = cardEffectFunctionMapFactory[nextKey]();
      return acc;
    }, {} as CardEffectFunctionMap);

    const eventEffectFunctionMap = Object.keys(eventEffectFactoryMap).reduce((acc, nextKey) => {
      acc[nextKey] = eventEffectFactoryMap[nextKey]();
      return acc;
    }, {} as CardEffectFunctionMap);

    const projectEffectFunctionMap = Object.keys(projectEffectFactoryMap).reduce((acc, nextKey) => {
      acc[nextKey] = projectEffectFactoryMap[nextKey]();
      return acc;
    }, {} as CardEffectFunctionMap);

    // Boon effects are registered per-match via expansion configurators.
    const boonEffectFunctionMap = {} as CardEffectFunctionMap;
    // Hex effects are registered per-match via expansion configurators.
    const hexEffectFunctionMap = {} as CardEffectFunctionMap;
    // State effects are registered per-match via expansion configurators.
    const stateEffectFunctionMap = {} as CardEffectFunctionMap;
    // Artifact effects are registered per-match via expansion configurators.
    const artifactEffectFunctionMap = {} as CardEffectFunctionMap;

    // Build an isolated DI scope for this match runtime graph.
    const scope = createContainer({
      injectionMode: InjectionMode.CLASSIC,
    });

    scope.register({
      socketMap: asValue(socketMap),
      match: asValue(match),
      cardLibrary: asValue(cardLibrary),
      cardSourceController: asValue(cardSourceController),
      cardInstanceFactoryService: asValue(cardInstanceFactoryService),
      endGamePolicyRegistryService: asValue(endGamePolicyRegistryService),
      runGameActionDelegate: asValue(runGameActionDelegate),
      expansionSearchService: asValue(this.expansionSearchService),
      matchSocketBindings: asValue(this.matchSocketBindings),
      cardEffectFunctionMap: asValue(cardEffectFunctionMap),
      eventEffectFunctionMap: asValue(eventEffectFunctionMap),
      projectEffectFunctionMap: asValue(projectEffectFunctionMap),
      boonEffectFunctionMap: asValue(boonEffectFunctionMap),
      hexEffectFunctionMap: asValue(hexEffectFunctionMap),
      stateEffectFunctionMap: asValue(stateEffectFunctionMap),
      artifactEffectFunctionMap: asValue(artifactEffectFunctionMap),
      logManager: asClass(LogManager).singleton(),
      cardPriceController: asClass(CardPriceRulesController).singleton(),
      findCardService: asClass(FindCardsService).singleton(),
      supplyGainService: asClass(DefaultSupplyGainService).singleton(),
      buyOptionsResolver: asClass(BuyOptionsResolver).singleton(),
      reactionManager: asClass(ReactionManager).singleton(),
      endGameEvaluator: asClass(EndGameEvaluatorService).singleton(),
      interactivityController: asClass(CardInteractivityController).singleton(),
      playerReconnectOrchestrator: asClass(PlayerReconnectOrchestrator).singleton(),
      gameActionsController: asClass(GameActionController).singleton(),
    });

    const logManager = scope.resolve<LogManager>('logManager');
    const cardPriceController = scope.resolve<CardPriceRulesController>('cardPriceController');
    const findCardService = scope.resolve<FindCardService>('findCardService');
    const supplyGainService = scope.resolve<SupplyGainService>('supplyGainService');
    const reactionManager = scope.resolve<ReactionManager>('reactionManager');
    const endGameEvaluator = scope.resolve<EndGameEvaluatorService>('endGameEvaluator');
    const interactivityController = scope.resolve<CardInteractivityController>('interactivityController');
    const playerReconnectOrchestrator = scope.resolve<PlayerReconnectOrchestrator>('playerReconnectOrchestrator');
    const gameActionsController = scope.resolve<GameActionController>('gameActionsController');

    return {
      logManager,
      cardPriceController,
      findCardService,
      supplyGainService,
      endGameEvaluator,
      reactionManager,
      interactivityController,
      playerReconnectOrchestrator,
      gameActionsController,
    };
  }
}
