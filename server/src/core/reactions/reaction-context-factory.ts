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
import { wrapActionServiceWithSource } from '../../utils/wrap-action-service-with-source.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';

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
    // Root singleton (registered as `expansionCatalogService` in register-root-services.ts;
    // Awilix CLASSIC resolves it by parameter name). Only game lifecycle contexts read from
    // it (see createGameLifecycleContext) — needed by runtime kingdom-reshaping code
    // (Rising Sun's Divine Wind) to compute candidate piles and synthesize configurator
    // contexts.
    private readonly expansionCatalogService: ExpansionCatalogService,
  ) {}

  // Common fields shared by every context this factory builds. Field differences between
  // context shapes (trigger/reaction, isRootLog, cardInstanceFactoryService) are added by each
  // create*Context method individually — see the type each returns before widening this.
  private baseContext(reactionManager: ReactionManager) {
    return {
      cardSourceController: this.cardSourceController,
      cardPriceController: this.cardPriceController,
      logManager: this.logManager,
      loggerService: this.loggerService,
      rngService: this.rngService,
      reactionManager,
      actionService: this.actionService,
      findCardService: this.findCardService,
      supplyGainService: this.supplyGainService,
      promptService: this.promptService,
      match: this.match,
      cardLibrary: this.cardLibrary,
    };
  }

  // Creates context for reaction condition checks.
  public createConditionContext<T extends TriggerEventType>(args: {
    reactionManager: ReactionManager;
    trigger: TriggeredEffectConditionContext<T>['trigger'];
    reaction: Reaction;
  }): TriggeredEffectConditionContext<T> {
    return {
      ...this.baseContext(args.reactionManager),
      trigger: args.trigger,
      reaction: args.reaction,
    };
  }

  // Creates context for game lifecycle callbacks.
  public createGameLifecycleContext(args: {
    reactionManager: ReactionManager;
  }): Omit<GameLifecycleCallbackContext, 'cardId'> {
    return {
      ...this.baseContext(args.reactionManager),
      // Only game lifecycle callbacks (e.g. onCardGained) currently need to mint new card
      // instances; other context shapes intentionally omit this.
      cardInstanceFactoryService: this.cardInstanceFactoryService,
      // Root expansion catalog + raw card library — see GameLifecycleCallbackContext for why.
      expansionCatalog: this.expansionCatalogService.getExpansionLibrary(),
      rawCardLibrary: this.expansionCatalogService.getRawCardLibrary(),
    };
  }

  // Creates context for card lifecycle callbacks.
  public createCardLifecycleContext(args: { reactionManager: ReactionManager }): CardLifecycleCallbackContext {
    return {
      ...this.baseContext(args.reactionManager),
    };
  }

  // Creates context for reaction triggered effects.
  public createTriggeredEffectContext<T extends TriggerEventType>(args: {
    reactionManager: ReactionManager;
    trigger: TriggeredEffectContext<T>['trigger'];
    reaction: Reaction;
  }): TriggeredEffectContext<T> {
    const base = this.baseContext(args.reactionManager);
    // Reactions registered from a card or card-like carry that source's id as
    // sourceId; wrap the action service so source-aware actions attribute
    // their log entries to it (e.g. a Duration card drawing on a later turn
    // logs "(Wharf)", a boon's detached end-of-turn draw logs "(The River's
    // Gift)"). Card-like sources (boon/hex/event/project/...) are tagged so
    // the client resolves the name outside the card library.
    const actionService =
      args.reaction.sourceId !== undefined
        ? wrapActionServiceWithSource(
          base.actionService,
          args.reaction.sourceType === 'card'
            ? args.reaction.sourceId
            : { kind: 'cardLike', id: args.reaction.sourceId },
        )
        : base.actionService;
    return {
      ...base,
      actionService,
      isRootLog: false,
      trigger: args.trigger,
      reaction: args.reaction,
    };
  }
}
