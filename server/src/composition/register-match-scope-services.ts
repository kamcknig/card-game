import { CardEffectFunctionMap } from '@server-types/index.ts';
import { asClass, asValue, AwilixContainer } from 'awilix';
import { CardSourceController } from '../core/card-source-controller.ts';
import { MatchCardLibrary } from '../core/match-card-library.ts';
import { MatchController } from '../core/match-controller.ts';
import { MatchSetupService } from '../core/match-setup-service.ts';
import { EndGamePolicyRegistryService } from '../core/end-game-policy-registry-service.ts';
import { CardInstanceFactoryService } from '../core/card-instance-factory-service.ts';
import { MatchEndService } from '../core/match-end-service.ts';
import { LoggerService } from '../core/logger-service.ts';
import { LogManager } from '../core/log-manager.ts';
import { CardPriceRulesController } from '../core/card-price-rules-controller.ts';
import { ReactionManager } from '../core/reactions/reaction-manager.ts';
import { ReactionContextFactory } from '../core/reactions/reaction-context-factory.ts';
import { CardInteractivityController } from '../core/card-interactivity-controller.ts';
import { GameActionController } from '../core/actions/game-action-controller.ts';
import { CardEffectContextFactory } from '../core/actions/card-effect-context-factory.ts';
import { PromptService } from '../core/prompt-service.ts';
import { FindCardsService } from '../core/find-cards-service.ts';
import { BuyOptionsResolver } from '../core/actions/resolve-buy-options.ts';
import { DefaultSupplyGainService } from '../core/supply-gain-service.ts';
import { EndGameEvaluatorService } from '../core/end-game-evaluator-service.ts';
import { PlayerReconnectOrchestrator } from '../core/player-reconnect-orchestrator.ts';
import { MatchScopeComposerArgs } from '../core/match-scope-factory.ts';
import { MatchActionRunnerRef, ScopedActionService } from '../core/actions/scoped-action-service.ts';
import { ExpansionEffectRegistryService } from '../core/expansion-effect-registry-service.ts';

export interface RegisterMatchScopeServicesArgs extends MatchScopeComposerArgs {
  expansionEffectRegistryService: ExpansionEffectRegistryService;
}

/**
 * Registers every match-lifetime dependency into a child scope.
 *
 * Includes:
 * - match state and socket bindings
 * - effect maps (card/event/project/boon/hex/state/artifact)
 * - controller/service graph used by `MatchController`
 *
 * Call this exactly once per created match scope before resolving `MatchController`.
 */
export const registerMatchScopeServices = (
  scope: AwilixContainer,
  args: RegisterMatchScopeServicesArgs,
): void => {
  const cardEffectFunctionMap = args.expansionEffectRegistryService.createCardEffectFunctionMap();
  const eventEffectFunctionMap = args.expansionEffectRegistryService.createEventEffectFunctionMap();
  const projectEffectFunctionMap = args.expansionEffectRegistryService.createProjectEffectFunctionMap();

  // Boon effects are registered per-match via expansion configurators.
  const boonEffectFunctionMap = {} as CardEffectFunctionMap;
  // Hex effects are registered per-match via expansion configurators.
  const hexEffectFunctionMap = {} as CardEffectFunctionMap;
  // State effects are registered per-match via expansion configurators.
  const stateEffectFunctionMap = {} as CardEffectFunctionMap;
  // Artifact effects are registered per-match via expansion configurators.
  const artifactEffectFunctionMap = {} as CardEffectFunctionMap;

  scope.register({
    socketMap: asValue(args.socketMap),
    match: asValue(args.match),
    loggerContext: asValue({ scope: 'match', matchScopeId: args.matchScopeId }),
    loggerService: asClass(LoggerService).singleton(),
    matchConfiguratorFactory: asValue(args.matchConfiguratorFactory),
    cardEffectFunctionMap: asValue(cardEffectFunctionMap),
    eventEffectFunctionMap: asValue(eventEffectFunctionMap),
    projectEffectFunctionMap: asValue(projectEffectFunctionMap),
    boonEffectFunctionMap: asValue(boonEffectFunctionMap),
    hexEffectFunctionMap: asValue(hexEffectFunctionMap),
    stateEffectFunctionMap: asValue(stateEffectFunctionMap),
    artifactEffectFunctionMap: asValue(artifactEffectFunctionMap),
    // Resolve card library from the match scope to avoid manual construction.
    cardLibrary: asClass(MatchCardLibrary).singleton(),
    cardSourceController: asClass(CardSourceController).singleton(),
    cardInstanceFactoryService: asClass(CardInstanceFactoryService).singleton(),
    matchActionRunnerRef: asClass(MatchActionRunnerRef).singleton(),
    actionService: asClass(ScopedActionService).singleton(),
    endGamePolicyRegistryService: asClass(EndGamePolicyRegistryService).singleton(),
    matchSetupService: asClass(MatchSetupService).singleton(),
    matchEndService: asClass(MatchEndService).singleton(),
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
    matchController: asClass(MatchController).singleton(),
  });
};
