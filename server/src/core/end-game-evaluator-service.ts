import { EndGameConditionFn, FindCardService, SupplyGainService } from '@server-types/index.ts';
import { Match, PlayerId } from 'shared/types/index.ts';
import { MatchCardLibrary } from './match-card-library.ts';
import { CardPriceRulesController } from './card-price-rules-controller.ts';
import { CardSourceController } from './card-source-controller.ts';
import { LogManager } from './log-manager.ts';
import { ReactionManager } from './reactions/reaction-manager.ts';
import { getStartingSupplyCount } from '../utils/get-starting-supply-count.ts';
import { renaissanceTokenIds } from '@expansions/renaissance/token-ids-renaissance.ts';

export interface EndGameEvaluationResult {
  shouldEndNow: boolean;
  fleetActivated: boolean;
}

// Evaluates game-end conditions for a match while MatchController handles orchestration.
export class EndGameEvaluatorService {
  constructor(
    private readonly match: Match,
    private readonly cardSourceController: CardSourceController,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly logManager: LogManager,
    private readonly reactionManager: ReactionManager,
    private readonly findCardService: FindCardService,
    private readonly supplyGainService: SupplyGainService,
  ) {}

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

  // Resolves Fleet-aware endgame transition and mutates match Fleet state when needed.
  public evaluateEndGame(expansionEndGameConditionFns: EndGameConditionFn[]): EndGameEvaluationResult {
    // Fleet latches game-end state once activated; do not re-evaluate end conditions during Fleet turns.
    if (this.match.fleetRound.completed) {
      console.info('[match] Fleet round completed; finalizing game end');
      return { shouldEndNow: true, fleetActivated: false };
    }

    if (this.match.fleetRound.active) {
      console.info('[match] game end latched; Fleet round still active');
      return { shouldEndNow: false, fleetActivated: false };
    }

    if (!this.shouldEndGame(expansionEndGameConditionFns)) {
      return { shouldEndNow: false, fleetActivated: false };
    }

    // Determine Fleet-eligible players once at game-end latch time.
    const fleetEligiblePlayerIds = this.getFleetEligiblePlayerIdsInOrder(this.match.currentPlayerTurnIndex);
    if (!fleetEligiblePlayerIds.length) {
      console.info('[match] no Fleet owners; ending game immediately');
      return { shouldEndNow: true, fleetActivated: false };
    }

    // Activate Fleet endgame round and defer final scoring until all Fleet turns are complete.
    this.match.fleetRound.active = true;
    this.match.fleetRound.completed = false;
    this.match.fleetRound.eligiblePlayerIdsInOrder = fleetEligiblePlayerIds;
    this.match.fleetRound.nextFleetPlayerIndex = 0;
    this.match.fleetRound.endingPlayerId = this.match.players[this.match.currentPlayerTurnIndex]?.id;
    this.match.fleetRound.startedAtTurnNumber = this.match.turnNumber;

    console.info(
      `[match] Fleet round activated by player ${this.match.fleetRound.endingPlayerId}; order: ${
        fleetEligiblePlayerIds.join(', ')
      }`,
    );

    return { shouldEndNow: false, fleetActivated: true };
  }

  // Returns true when the given player currently owns Fleet via a cube token.
  private doesPlayerOwnFleet(playerId: PlayerId): boolean {
    const fleetProjectId = this.match.projects.find((project) => project.cardKey === 'fleet')?.id;
    if (fleetProjectId === undefined) {
      return false;
    }

    return Object.values(this.match.tokens ?? {}).some((token) =>
      token.tokenId === renaissanceTokenIds.cube &&
      token.ownerId === playerId &&
      token.location.type === 'cardLike' &&
      token.location.cardLikeId === fleetProjectId
    );
  }

  // Builds Fleet turn order starting with the next player after the player ending the game.
  private getFleetEligiblePlayerIdsInOrder(endingPlayerIndex: number): PlayerId[] {
    const players = this.match.players;
    const eligiblePlayerIds: PlayerId[] = [];
    if (!players.length) {
      return eligiblePlayerIds;
    }

    for (let offset = 1; offset <= players.length; offset++) {
      const playerIndex = (endingPlayerIndex + offset) % players.length;
      const player = players[playerIndex];
      if (!player) continue;
      if (this.doesPlayerOwnFleet(player.id)) {
        eligiblePlayerIds.push(player.id);
      }
    }

    return eligiblePlayerIds;
  }
}
