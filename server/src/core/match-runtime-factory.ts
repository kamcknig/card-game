import {Match, PlayerId} from 'shared/types/index.ts';
import {AppSocket, CardEffectFunctionMap, FindCardsFn} from '@server-types/index.ts';
import {LogManager} from './log-manager.ts';
import {CardPriceRulesController} from './card-price-rules-controller.ts';
import {findCardsFactory} from '../utils/find-cards.ts';
import {ReactionManager} from './reactions/reaction-manager.ts';
import {cardEffectFunctionMapFactory} from './effects/card-effect-function-map-factory.ts';
import {eventEffectFactoryMap} from './events/event-effect-factory-map.ts';
import {projectEffectFactoryMap} from './projects/project-effect-factory-map.ts';
import {CardInteractivityController} from './card-interactivity-controller.ts';
import {GameActionController} from './actions/game-action-controller.ts';
import {CardSourceController} from './card-source-controller.ts';
import {MatchCardLibrary} from './match-card-library.ts';
import {asClass, asFunction, asValue, createContainer, InjectionMode} from 'awilix';

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
  findCards: FindCardsFn;
  reactionManager: ReactionManager;
  interactivityController: CardInteractivityController;
  gameActionsController: GameActionController;
}

// Builds the per-match runtime graph (controllers/managers/maps) used by MatchController.
export class MatchRuntimeFactory {
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
      injectionMode: InjectionMode.PROXY,
    });

    scope.register({
      socketMap: asValue(socketMap),
      match: asValue(match),
      cardLibrary: asValue(cardLibrary),
      cardSourceController: asValue(cardSourceController),
      runGameActionDelegate: asValue(runGameActionDelegate),
      cardEffectFunctionMap: asValue(cardEffectFunctionMap),
      eventEffectFunctionMap: asValue(eventEffectFunctionMap),
      projectEffectFunctionMap: asValue(projectEffectFunctionMap),
      boonEffectFunctionMap: asValue(boonEffectFunctionMap),
      hexEffectFunctionMap: asValue(hexEffectFunctionMap),
      stateEffectFunctionMap: asValue(stateEffectFunctionMap),
      artifactEffectFunctionMap: asValue(artifactEffectFunctionMap),
      logManager: asClass(LogManager).singleton(),
      cardPriceController: asClass(CardPriceRulesController).singleton(),
      findCards: asFunction(({cardSourceController, cardPriceController, cardLibrary}) =>
        findCardsFactory(cardSourceController, cardPriceController, cardLibrary)
      ).singleton(),
      reactionManager: asClass(ReactionManager).singleton(),
      interactivityController: asClass(CardInteractivityController).singleton(),
      gameActionsController: asClass(GameActionController).singleton(),
    });

    const logManager = scope.resolve<LogManager>('logManager');
    const cardPriceController = scope.resolve<CardPriceRulesController>('cardPriceController');
    const findCards = scope.resolve<FindCardsFn>('findCards');
    const reactionManager = scope.resolve<ReactionManager>('reactionManager');
    const interactivityController = scope.resolve<CardInteractivityController>('interactivityController');
    const gameActionsController = scope.resolve<GameActionController>('gameActionsController');

    return {
      logManager,
      cardPriceController,
      findCards,
      reactionManager,
      interactivityController,
      gameActionsController,
    };
  }
}
