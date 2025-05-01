import { Card, CardCost, CardKey, Match, PlayerId } from 'shared/shared-types.ts';

export type CardPriceRule = (
  card: Card,
  context: { match: Match, playerId: PlayerId }
) => ({ restricted: boolean; cost: CardCost });

export class CardPriceRulesController {
  private _rules: Record<CardKey, CardPriceRule[]> = {};
  
  registerRule(cardKey: CardKey, rule: CardPriceRule) {
    this._rules[cardKey] ??= [];
    this._rules[cardKey].push(rule);
  }
  
  applyRules(card: Card, { match, playerId }: { match: Match, playerId: PlayerId }) {
    console.log(`[card price controller] running price rules for ${card}`);
    let restricted = false;
    let modifiedCost = { ...card.cost };
    
    const rules = this._rules[card.cardKey];
    if (!rules) {
      return { restricted, cost: modifiedCost };
    }
    
    for (const rule of rules) {
      const result = rule(card, {match, playerId });
      
      restricted ||= result.restricted;
      
      modifiedCost = {
        treasure: Math.max(0, modifiedCost.treasure + (result.cost.treasure ?? 0)),
        potion: Math.max(0, (modifiedCost.potion ?? 0) + (result.cost.potion ?? 0))
      }
    }
    
    return { restricted, cost: modifiedCost };
  }
}