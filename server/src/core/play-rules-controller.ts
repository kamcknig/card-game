import { Card, CardLocation, Match, PlayerId, TurnPhase } from 'shared/types/index.ts';

export type PlayRuleResult = {
  canPlay: boolean;
  reasons?: string[];
};

export type PlayRuleContext = {
  playerId: PlayerId;
  phase: TurnPhase;
  sourceLocation?: CardLocation;
  sourcePlayerId?: PlayerId;
};

export type CardPlayRule = (card: Card, context: PlayRuleContext & { match: Match }) => PlayRuleResult;

export class PlayRulesController {
  private readonly rules: CardPlayRule[] = [];

  constructor(private readonly match: Match) {}

  public registerRule(rule: CardPlayRule): () => void {
    this.rules.push(rule);

    return () => {
      const index = this.rules.findIndex(existingRule => existingRule === rule);
      if (index !== -1) {
        this.rules.splice(index, 1);
      }
    };
  }

  public applyRules(card: Card, context: PlayRuleContext): { canPlay: boolean; reasons: string[] } {
    if (this.rules.length < 1) {
      return { canPlay: true, reasons: [] };
    }

    const reasons: string[] = [];
    let canPlay = true;

    for (const rule of this.rules) {
      const ruleResult = rule(card, { ...context, match: this.match });
      if (!ruleResult.canPlay) {
        canPlay = false;
        if (ruleResult.reasons?.length) {
          reasons.push(...ruleResult.reasons);
        }
      }
    }

    return { canPlay, reasons: [...new Set(reasons)] };
  }
}
