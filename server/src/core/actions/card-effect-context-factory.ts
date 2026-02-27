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
import { PlayRulesController } from '../play-rules-controller.ts';
import { CardSourceController } from '../card-source-controller.ts';
import { RngService } from '../rng-service.ts';
import { LoggerService } from '../logger-service.ts';

export type CreateCardEffectContextArgs = {
  cardId: CardLikeId;
  playerId: PlayerId;
  reactionContext: CardEffectFunctionContext['reactionContext'];
  cardEffectFunctionMap: CardEffectFunctionContext['cardEffectFunctionMap'];
  customCardEffectHandlers: CardEffectFunctionContext['customCardEffectHandlers'];
  registerDurationEffect: CardEffectFunctionContext['registerDurationEffect'];
};

// Builds card effect contexts with a single shared wiring path for injected services.
export class CardEffectContextFactory {
  constructor(
    private readonly cardSourceController: CardSourceController,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly playRulesController: PlayRulesController,
    private readonly logManager: LogManager,
    private readonly loggerService: LoggerService,
    private readonly rngService: RngService,
    private readonly reactionManager: ReactionManager,
    private readonly actionService: ActionService,
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly findCardService: FindCardService,
    private readonly supplyGainService: SupplyGainService,
    private readonly promptService: PromptService,
  ) {}

  // Creates a fully wired effect context for landscape effect execution.
  public create(args: CreateCardEffectContextArgs): CardEffectFunctionContext {
    return {
      cardSourceController: this.cardSourceController,
      cardPriceController: this.cardPriceController,
      playRulesController: this.playRulesController,
      logManager: this.logManager,
      loggerService: this.loggerService,
      rngService: this.rngService,
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
      cardEffectFunctionMap: args.cardEffectFunctionMap,
      customCardEffectHandlers: args.customCardEffectHandlers,
      registerDurationEffect: args.registerDurationEffect,
    };
  }
}
