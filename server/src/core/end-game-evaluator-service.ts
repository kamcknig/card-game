import { EndGameConditionFn, FindCardService, SupplyGainService } from '@server-types/index.ts';
import { Match } from 'shared/types/index.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { CardSourceController } from './card-source-controller.ts';
import { LogManager } from './log-manager.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';
import { getStartingSupplyCount } from '../utils/get-starting-supply-count.ts';

// Evaluates game-end conditions for a match while MatchController handles orchestration.
export class EndGameEvaluatorService {
  constructor(
    private readonly _match: Match,
    private readonly _cardSourceController: CardSourceController,
    private readonly _cardLibrary: MatchCardLibrary,
    private readonly _cardPriceController: CardPriceRulesController,
    private readonly _logManager: LogManager,
    private readonly _reactionManager: ReactionManager,
    private readonly _findCardService: FindCardService,
    private readonly _supplyGainService: SupplyGainService,
  ) {}

  public shouldEndGame(expansionEndGameConditionFns: EndGameConditionFn[]): boolean {
    if (
      this._findCardService.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'province' },
      ]).length === 0
    ) {
      console.info('[match] supply has no more provinces');
      return true;
    }

    const startingSupplyCount = getStartingSupplyCount(this._match);
    const remainingSupplyCount = this._findCardService.getRemainingSupplyCount();
    const emptyPileCount = startingSupplyCount - remainingSupplyCount;

    console.debug(`[match] empty pile count ${emptyPileCount}`);

    if (emptyPileCount === 3) {
      console.info('[match] three supply piles are empty');
      return true;
    }

    for (const conditionFn of expansionEndGameConditionFns) {
      const shouldEnd = conditionFn({
        cardSourceController: this._cardSourceController,
        match: this._match,
        cardLibrary: this._cardLibrary,
        cardPriceController: this._cardPriceController,
        logManager: this._logManager,
        reactionManager: this._reactionManager,
        findCardService: this._findCardService,
        supplyGainService: this._supplyGainService,
      });
      if (shouldEnd) {
        console.info('[match] expansion end-game condition met');
        return true;
      }
    }

    return false;
  }
}
