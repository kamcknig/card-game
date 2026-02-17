import {CardEffectFunctionMap} from '@server-types/index.ts';
import {LogManager} from './log-manager.ts';
import {CardPriceRulesController} from './card-price-rules-controller.ts';
import {ReactionManager} from './reactions/reaction-manager.ts';
import {ReactionContextFactory} from './reactions/reaction-context-factory.ts';
import {cardEffectFunctionMapFactory} from './effects/card-effect-function-map-factory.ts';
import {eventEffectFactoryMap} from './events/event-effect-factory-map.ts';
import {projectEffectFactoryMap} from './projects/project-effect-factory-map.ts';
import {CardInteractivityController} from './card-interactivity-controller.ts';
import {GameActionController} from './actions/game-action-controller.ts';
import {CardEffectContextFactory} from './actions/card-effect-context-factory.ts';
import {PromptService} from './prompt-service.ts';
import {asClass, asValue, AwilixContainer} from 'awilix';
import {FindCardsService} from './find-cards-service.ts';
import {BuyOptionsResolver} from './actions/resolve-buy-options.ts';
import {DefaultSupplyGainService} from './supply-gain-service.ts';
import {EndGameEvaluatorService} from './end-game-evaluator-service.ts';
import {PlayerReconnectOrchestrator} from './player-reconnect-orchestrator.ts';
import {ExpansionSearchService} from './expansion-search-service.ts';
import {MatchSocketBindings} from './match-socket-bindings.ts';

// Builds the per-match runtime graph (controllers/managers/maps) used by MatchController.
export class MatchRuntimeFactory {
  constructor(
    private readonly expansionSearchService: ExpansionSearchService,
    private readonly matchSocketBindings: MatchSocketBindings,
  ) {}

  // Registers runtime services into an existing match scope.
  public register(scope: AwilixContainer): void {
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

    scope.register({
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
      promptService: asClass(PromptService).singleton(),
      cardEffectContextFactory: asClass(CardEffectContextFactory).singleton(),
      buyOptionsResolver: asClass(BuyOptionsResolver).singleton(),
      reactionContextFactory: asClass(ReactionContextFactory).singleton(),
      reactionManager: asClass(ReactionManager).singleton(),
      endGameEvaluator: asClass(EndGameEvaluatorService).singleton(),
      interactivityController: asClass(CardInteractivityController).singleton(),
      playerReconnectOrchestrator: asClass(PlayerReconnectOrchestrator).singleton(),
      gameActionsController: asClass(GameActionController).singleton(),
    });
  }
}
