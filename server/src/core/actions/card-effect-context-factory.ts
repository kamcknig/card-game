import {
  ActionService,
  CardEffectFunctionContext,
  FindCardService,
  PromptService,
  SupplyGainService,
} from '@server-types/index.ts';
import { CardLikeId, Match, PlayerId } from 'shared/types/index.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { LogManager } from '../log-manager.ts';
import { ReactionManager } from '../reactions/reaction-manager.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { CardSourceController } from '../card-source-controller.ts';

export type CreateCardEffectContextArgs = {
  cardId: CardLikeId;
  playerId: PlayerId;
  reactionContext: CardEffectFunctionContext['reactionContext'];
  registerDurationEffect: CardEffectFunctionContext['registerDurationEffect'];
};

// Builds card effect contexts with a single shared wiring path for injected services.
export class CardEffectContextFactory {
  constructor(
    private readonly cardSourceController: CardSourceController,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly logManager: LogManager,
    private readonly reactionManager: ReactionManager,
    private readonly actionService: ActionService,
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly findCardService: FindCardService,
    private readonly supplyGainService: SupplyGainService,
    private readonly promptService: PromptService,
  ) {}

  // Creates a fully wired effect context for card-like effect execution.
  public create(args: CreateCardEffectContextArgs): CardEffectFunctionContext {
    return {
      cardSourceController: this.cardSourceController,
      cardPriceController: this.cardPriceController,
      logManager: this.logManager,
      reactionManager: this.reactionManager,
      actionService: this.actionService,
      cardId: args.cardId,
      playerId: args.playerId,
      match: this.match,
      cardLibrary: this.cardLibrary,
      reactionContext: args.reactionContext,
      findCardService: this.findCardService,
      supplyGainService: this.supplyGainService,
      promptService: this.promptService,
      registerDurationEffect: args.registerDurationEffect,
    };
  }
}
