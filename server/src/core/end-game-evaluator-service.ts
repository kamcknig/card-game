import { EndGamePolicyFnOutcome, FindCardService, PromptService, SupplyGainService } from '@server-types/index.ts';
import { Match } from 'shared/types/index.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { CardSourceController } from './card-source-controller.ts';
import { LogManager } from './log-manager.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';
import { getStartingSupplyCount } from '../utils/get-starting-supply-count.ts';
import { EndGamePolicyRegistryService } from './end-game-policy-registry-service.ts';
import { RngService } from './rng-service.ts';
import { LoggerService } from './logger-service.ts';

export interface EndGameEvaluationResult {
  shouldEndNow: boolean;
}

// Evaluates endgame through base rules plus expansion-registered policy functions.
export class EndGameEvaluatorService {
  constructor(
    private readonly match: Match,
    private readonly cardSourceController: CardSourceController,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly logManager: LogManager,
    private readonly rngService: RngService,
    private readonly reactionManager: ReactionManager,
    private readonly findCardService: FindCardService,
    private readonly supplyGainService: SupplyGainService,
    private readonly promptService: PromptService,
    private readonly endGamePolicyRegistryService: EndGamePolicyRegistryService,
    private readonly loggerService: LoggerService,
  ) {}

  public evaluateEndGame(): EndGameEvaluationResult {
    let endTriggered = this.shouldEndGame();

    for (const policy of this.endGamePolicyRegistryService.getPolicies()) {
      const outcome = policy({
        cardSourceController: this.cardSourceController,
        match: this.match,
        cardLibrary: this.cardLibrary,
        cardPriceController: this.cardPriceController,
        logManager: this.logManager,
        loggerService: this.loggerService,
        rngService: this.rngService,
        reactionManager: this.reactionManager,
        findCardService: this.findCardService,
        supplyGainService: this.supplyGainService,
        promptService: this.promptService,
        endTriggered,
      });
      const decision = this.applyOutcome(outcome);
      if (outcome.endTriggered !== undefined) {
        // Policies contribute ADDITIVE end conditions. They must never clear a
        // trigger produced by base rules or an earlier policy — suppression is
        // expressed via `decision` ('defer'/'continue'), not by clearing the flag.
        endTriggered = endTriggered || outcome.endTriggered;
      }
      if (decision === 'end_now') {
        return { shouldEndNow: true };
      }
      if (decision === 'defer') {
        return { shouldEndNow: false };
      }
    }

    return { shouldEndNow: endTriggered };
  }

  public shouldEndGame(): boolean {
    if (this.findCardService.findCards({ all: [{ location: 'basicSupply' }, { cardKeys: 'province' }] }).length === 0) {
      this.loggerService.info('[match] supply has no more provinces');
      return true;
    }

    const startingSupplyCount = getStartingSupplyCount(this.match);
    const remainingSupplyCount = this.findCardService.getRemainingSupplyCount();
    const emptyPileCount = startingSupplyCount - remainingSupplyCount;
    this.loggerService.debug(`[match] empty pile count ${emptyPileCount}`);

    // Latch: once three or more piles are empty the game must end even if a
    // deferral window (e.g. Fleet) let a fourth pile empty in the meantime.
    if (emptyPileCount >= 3) {
      this.loggerService.info('[match] three or more supply piles are empty');
      return true;
    }

    return false;
  }

  private applyOutcome(outcome: EndGamePolicyFnOutcome): 'continue' | 'defer' | 'end_now' {
    if (outcome.decision === 'defer') {
      return 'defer';
    }
    if (outcome.decision === 'end_now') {
      return 'end_now';
    }
    return 'continue';
  }
}
