import {
  ActionService,
  CardLifecycleCallbackContext,
  FindCardService,
  GameLifecycleCallbackContext,
  PromptService,
  Reaction,
  SupplyGainService,
  TriggeredEffectConditionContext,
  TriggeredEffectContext,
  TriggerEventType,
} from '@server-types/index.ts';
import { Match } from 'shared/types/index.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { CardInstanceFactoryService } from '../card-instance-factory-service.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { CardSourceController } from '../card-source-controller.ts';
import { LogManager } from '../log-manager.ts';
import { RngService } from '../rng-service.ts';
import { LoggerService } from '../logger-service.ts';
import type { ReactionManager } from './reaction-manager.ts';

// Centralized builder for reaction/lifecycle callback contexts.
export class ReactionContextFactory {
  constructor(
    private readonly cardSourceController: CardSourceController,
    private readonly findCardService: FindCardService,
    private readonly supplyGainService: SupplyGainService,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly logManager: LogManager,
    private readonly loggerService: LoggerService,
    private readonly rngService: RngService,
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly cardInstanceFactoryService: CardInstanceFactoryService,
    private readonly actionService: ActionService,
    private readonly promptService: PromptService,
  ) {}

  // Creates context for reaction condition checks.
  public createConditionContext<T extends TriggerEventType>(args: {
    reactionManager: ReactionManager;
    trigger: TriggeredEffectConditionContext<T>['trigger'];
    reaction: Reaction;
  }): TriggeredEffectConditionContext<T> {
    return {
      cardSourceController: this.cardSourceController,
      cardPriceController: this.cardPriceController,
      logManager: this.logManager,
      loggerService: this.loggerService,
      rngService: this.rngService,
      reactionManager: args.reactionManager,
      actionService: this.actionService,
      findCardService: this.findCardService,
      supplyGainService: this.supplyGainService,
      promptService: this.promptService,
      match: this.match,
      cardLibrary: this.cardLibrary,
      trigger: args.trigger,
      reaction: args.reaction,
    };
  }

  // Creates context for game lifecycle callbacks.
  public createGameLifecycleContext(args: {
    reactionManager: ReactionManager;
  }): Omit<GameLifecycleCallbackContext, 'cardId'> {
    return {
      cardSourceController: this.cardSourceController,
      findCardService: this.findCardService,
      supplyGainService: this.supplyGainService,
      cardPriceController: this.cardPriceController,
      logManager: this.logManager,
      loggerService: this.loggerService,
      rngService: this.rngService,
      cardLibrary: this.cardLibrary,
      cardInstanceFactoryService: this.cardInstanceFactoryService,
      match: this.match,
      reactionManager: args.reactionManager,
      actionService: this.actionService,
      promptService: this.promptService,
    };
  }

  // Creates context for card lifecycle callbacks.
  public createCardLifecycleContext(args: {
    reactionManager: ReactionManager;
  }): CardLifecycleCallbackContext {
    return {
      cardSourceController: this.cardSourceController,
      actionService: this.actionService,
      cardPriceController: this.cardPriceController,
      logManager: this.logManager,
      loggerService: this.loggerService,
      rngService: this.rngService,
      cardLibrary: this.cardLibrary,
      match: this.match,
      reactionManager: args.reactionManager,
      findCardService: this.findCardService,
      supplyGainService: this.supplyGainService,
      promptService: this.promptService,
    };
  }

  // Creates context for reaction triggered effects.
  public createTriggeredEffectContext<T extends TriggerEventType>(args: {
    reactionManager: ReactionManager;
    trigger: TriggeredEffectContext<T>['trigger'];
    reaction: Reaction;
  }): TriggeredEffectContext<T> {
    return {
      cardSourceController: this.cardSourceController,
      findCardService: this.findCardService,
      supplyGainService: this.supplyGainService,
      reactionManager: args.reactionManager,
      cardPriceController: this.cardPriceController,
      logManager: this.logManager,
      loggerService: this.loggerService,
      rngService: this.rngService,
      isRootLog: false,
      actionService: this.actionService,
      promptService: this.promptService,
      trigger: args.trigger,
      cardLibrary: this.cardLibrary,
      match: this.match,
      reaction: args.reaction,
    };
  }
}
