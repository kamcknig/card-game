import { EndGameConditionFn, FindCardService, SupplyGainService } from '@server-types/index.ts';
import { Match } from 'shared/types/index.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { CardSourceController } from './card-source-controller.ts';
import { LogManager } from './log-manager.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';
import { getStartingSupplyCount } from '../utils/get-starting-supply-count.ts';

export interface EndGameEvaluatorServiceDependencies {
  match: Match;
  cardSourceController: CardSourceController;
  cardLibrary: MatchCardLibrary;
  cardPriceController: CardPriceRulesController;
  logManager: LogManager;
  reactionManager: ReactionManager;
  findCardService: FindCardService;
  supplyGainService: SupplyGainService;
}

// Evaluates game-end conditions for a match while MatchController handles orchestration.
export class EndGameEvaluatorService {
  private readonly match: Match;
  private readonly cardSourceController: CardSourceController;
  private readonly cardLibrary: MatchCardLibrary;
  private readonly cardPriceController: CardPriceRulesController;
  private readonly logManager: LogManager;
  private readonly reactionManager: ReactionManager;
  private readonly findCardService: FindCardService;
  private readonly supplyGainService: SupplyGainService;

  constructor(
    match: Match,
    cardSourceController: CardSourceController,
    cardLibrary: MatchCardLibrary,
    cardPriceController: CardPriceRulesController,
    logManager: LogManager,
    reactionManager: ReactionManager,
    findCardService: FindCardService,
    supplyGainService: SupplyGainService,
  ) {
    this.match = match;
    this.cardSourceController = cardSourceController;
    this.cardLibrary = cardLibrary;
    this.cardPriceController = cardPriceController;
    this.logManager = logManager;
    this.reactionManager = reactionManager;
    this.findCardService = findCardService;
    this.supplyGainService = supplyGainService;
  }

  public shouldEndGame(expansionEndGameConditionFns: EndGameConditionFn[]): boolean {
    if (
      this.findCardService.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'province' },
      ]).length === 0
    ) {
      console.info('[match] supply has no more provinces');
      return true;
    }

    const startingSupplyCount = getStartingSupplyCount(this.match);
    const remainingSupplyCount = this.findCardService.getRemainingSupplyCount();
    const emptyPileCount = startingSupplyCount - remainingSupplyCount;

    console.debug(`[match] empty pile count ${emptyPileCount}`);

    if (emptyPileCount === 3) {
      console.info('[match] three supply piles are empty');
      return true;
    }

    for (const conditionFn of expansionEndGameConditionFns) {
      const shouldEnd = conditionFn({
        cardSourceController: this.cardSourceController,
        match: this.match,
        cardLibrary: this.cardLibrary,
        cardPriceController: this.cardPriceController,
        logManager: this.logManager,
        reactionManager: this.reactionManager,
        findCardService: this.findCardService,
        supplyGainService: this.supplyGainService,
      });
      if (shouldEnd) {
        console.info('[match] expansion end-game condition met');
        return true;
      }
    }

    return false;
  }
}
