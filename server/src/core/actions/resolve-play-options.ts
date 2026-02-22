import { Card, CardId, CardLocation, Match, PlayerId, TurnPhase, TurnPhaseOrderValues } from 'shared/types/index.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { CardSourceController } from '../card-source-controller.ts';
import { PlayRulesController } from '../play-rules-controller.ts';

export type ResolveCanPlayArgs = {
  cardId: CardId | Card;
  playerId: PlayerId;
  phase?: TurnPhase;
};

export type ResolveCanPlayResult = {
  card: Card;
  canPlay: boolean;
  reasons: string[];
};

export class PlayOptionsResolver {
  constructor(
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly cardSourceController: CardSourceController,
    private readonly playRulesController: PlayRulesController,
  ) {}

  public resolveCanPlay(args: ResolveCanPlayArgs): ResolveCanPlayResult {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const reasons: string[] = [];
    const phase = args.phase ?? TurnPhaseOrderValues[this.match.turnPhaseIndex];

    let sourceLocation: CardLocation | undefined;
    let sourcePlayerId: PlayerId | undefined;
    try {
      const source = this.cardSourceController.findCardSource(card.id);
      sourceLocation = source.sourceKey;
      sourcePlayerId = source.playerId;
    } catch {
      reasons.push('Card source could not be resolved.');
      return { card, canPlay: false, reasons };
    }

    if (sourceLocation !== 'playerHand' || sourcePlayerId !== args.playerId) {
      reasons.push('Card is not in the current player hand.');
    }

    if (phase === 'action') {
      if (!card.type.includes('ACTION')) {
        reasons.push('Card is not an Action card.');
      }
      if (this.match.playerActions < 1) {
        reasons.push('No Actions available.');
      }
    } else if (phase === 'buy') {
      if (!card.type.includes('TREASURE')) {
        reasons.push('Card is not a Treasure card.');
      }
    } else if (phase === 'night') {
      if (!card.type.includes('NIGHT')) {
        reasons.push('Card is not a Night card.');
      }
    } else {
      reasons.push(`Cards cannot be played during the ${phase} phase.`);
    }

    const playRuleResult = this.playRulesController.applyRules(card, {
      playerId: args.playerId,
      phase,
      sourceLocation,
      sourcePlayerId,
    });
    if (!playRuleResult.canPlay) {
      reasons.push(...playRuleResult.reasons);
    }

    return {
      card,
      canPlay: reasons.length < 1,
      reasons: [...new Set(reasons)],
    };
  }
}
