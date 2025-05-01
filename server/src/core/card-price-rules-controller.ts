import { Card, CardCost, CardId, Match, PlayerId } from 'shared/shared-types.ts';

export type CardPriceRule = (
  card: Card,
  context: { match: Match, playerId: PlayerId }
) => ({ restricted: boolean; cost: CardCost });

export class CardPriceRulesController {
  private _rules: Record<CardId, CardPriceRule[]> = {};
  
  registerRule(card: Card, rule: CardPriceRule) {
    this._rules[card.id] ??= [];
    this._rules[card.id].push(rule);
    
    return () => {
      const idx = this._rules[card.id].findIndex(r => r === rule);
      if (idx !== -1) {
        this._rules[card.id].splice(idx, 1);
      }
    }
  }
  
  applyRules(card: Card, { match, playerId }: { match: Match, playerId: PlayerId }) {
    console.log(`[card price controller] running price rules for ${card}`);
    let restricted = false;
    let modifiedCost = { ...card.cost };
    
    const rules = this._rules[card.id];
    if (!rules) {
      return { restricted, cost: modifiedCost };
    }
    
    for (const rule of rules) {
      const result = rule(card, { match, playerId });
      
      restricted ||= result.restricted;
      
      modifiedCost = {
        treasure: Math.max(0, modifiedCost.treasure + (result.cost.treasure ?? 0)),
        potion: Math.max(0, (modifiedCost.potion ?? 0) + (result.cost.potion ?? 0))
      }
    }
    
    return { restricted, cost: modifiedCost };
  }
}