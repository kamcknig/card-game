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

export interface MatchRuntimeFactoryArgs {
  socketMap: Map<PlayerId, AppSocket>;
  match: Match;
  cardLibrary: MatchCardLibrary;
  cardSourceController: CardSourceController;
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
    private readonly _expansionSearchService: ExpansionSearchService,
    private readonly _matchSocketBindings: MatchSocketBindings,
  ) {}

  public create({
    socketMap,
    match,
    cardLibrary,
    cardSourceController,
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
      _socketMap: asValue(socketMap),
      _match: asValue(match),
      _cardLibrary: asValue(cardLibrary),
      _cardSourceController: asValue(cardSourceController),
      _runGameActionDelegate: asValue(runGameActionDelegate),
      _expansionSearchService: asValue(this._expansionSearchService),
      _matchSocketBindings: asValue(this._matchSocketBindings),
      _cardEffectFunctionMap: asValue(cardEffectFunctionMap),
      _eventEffectFunctionMap: asValue(eventEffectFunctionMap),
      _projectEffectFunctionMap: asValue(projectEffectFunctionMap),
      _boonEffectFunctionMap: asValue(boonEffectFunctionMap),
      _hexEffectFunctionMap: asValue(hexEffectFunctionMap),
      _stateEffectFunctionMap: asValue(stateEffectFunctionMap),
      _artifactEffectFunctionMap: asValue(artifactEffectFunctionMap),
      _logManager: asClass(LogManager).singleton(),
      _cardPriceController: asClass(CardPriceRulesController).singleton(),
      _findCardService: asClass(FindCardsService).singleton(),
      _supplyGainService: asClass(DefaultSupplyGainService).singleton(),
      _buyOptionsResolver: asClass(BuyOptionsResolver).singleton(),
      _reactionManager: asClass(ReactionManager).singleton(),
      _endGameEvaluator: asClass(EndGameEvaluatorService).singleton(),
      _interactivityController: asClass(CardInteractivityController).singleton(),
      _playerReconnectOrchestrator: asClass(PlayerReconnectOrchestrator).singleton(),
      _gameActionsController: asClass(GameActionController).singleton(),
    });

    const logManager = scope.resolve<LogManager>('_logManager');
    const cardPriceController = scope.resolve<CardPriceRulesController>('_cardPriceController');
    const findCardService = scope.resolve<FindCardService>('_findCardService');
    const supplyGainService = scope.resolve<SupplyGainService>('_supplyGainService');
    const reactionManager = scope.resolve<ReactionManager>('_reactionManager');
    const endGameEvaluator = scope.resolve<EndGameEvaluatorService>('_endGameEvaluator');
    const interactivityController = scope.resolve<CardInteractivityController>('_interactivityController');
    const playerReconnectOrchestrator = scope.resolve<PlayerReconnectOrchestrator>('_playerReconnectOrchestrator');
    const gameActionsController = scope.resolve<GameActionController>('_gameActionsController');

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
