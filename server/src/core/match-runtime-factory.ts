import {Card, CardId, Match, PlayerId} from 'shared/types/index.ts';
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
    const logManager = new LogManager({
      socketMap,
    });

    const cardPriceController = new CardPriceRulesController(
      cardLibrary,
      match,
    );

    const findCards = findCardsFactory(cardSourceController, cardPriceController, cardLibrary);

    const reactionManager = new ReactionManager(
      cardSourceController,
      findCards,
      cardPriceController,
      logManager,
      match,
      cardLibrary,
      runGameActionDelegate as any,
    );

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

    const interactivityController = new CardInteractivityController(
      cardSourceController,
      cardPriceController,
      match,
      socketMap,
      cardLibrary,
      runGameActionDelegate as any,
      findCards,
    );

    const gameActionsController = new GameActionController(
      cardSourceController,
      findCards,
      cardPriceController,
      cardEffectFunctionMap,
      eventEffectFunctionMap,
      projectEffectFunctionMap,
      boonEffectFunctionMap,
      hexEffectFunctionMap,
      stateEffectFunctionMap,
      artifactEffectFunctionMap,
      match,
      cardLibrary,
      logManager,
      socketMap,
      reactionManager,
      runGameActionDelegate as any,
      interactivityController,
    );

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

