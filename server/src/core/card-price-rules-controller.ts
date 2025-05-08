import { Card, CardCost, CardId, Match, PlayerId } from 'shared/shared-types.ts';
import { CardLibrary } from './card-library.ts';

export type CardPriceRule = (
  card: Card,
  context: { match: Match, playerId: PlayerId }
) => ({ restricted: boolean; cost: CardCost });

export class CardPriceRulesController {
  private _rules: Record<CardId, CardPriceRule[]> = {};
  
  constructor(
    private readonly cardLibrary: CardLibrary,
    private readonly match: Match,
  ) {
  }
  
  registerRule(card: Card, rule: CardPriceRule) {
    this._rules[card.id] ??= [];
    this._rules[card.id].push(rule);
    
    return () => {
      const idx = this._rules[card.id].findIndex(r => r === rule);
      if (idx !== -1) {
        this._rules[card.id].splice(idx, 1);
      }
      return void 0;
    }
  }
  
  applyRules(card: Card, { playerId }: { playerId: PlayerId }) {
    let restricted = false;
    let modifiedCost = { ...card.cost };
    
    const rules = this._rules[card.id];
    if (!rules) {
      return { restricted, cost: modifiedCost };
    }
    
    for (const rule of rules) {
      const result = rule(card, { match: this.match, playerId });
      
      restricted ||= result.restricted;
      
      modifiedCost = {
        treasure: Math.max(0, modifiedCost.treasure + (result.cost.treasure ?? 0)),
        potion: Math.max(0, (modifiedCost.potion ?? 0) + (result.cost.potion ?? 0))
      }
    }
    
    return { restricted, cost: modifiedCost };
  }
  
  calculateOverrides() {
    const costOverrides: Record<PlayerId, Record<CardId, Partial<Card>>> = {};
    
    const cards = this.cardLibrary.getAllCardsAsArray();
    for (const player of this.match.players) {
      for (const card of cards) {
        const { cost } =
          this.applyRules(card, { playerId: player.id })
        costOverrides[player.id] ??= {};
        costOverrides[player.id][card.id] = {
          cost
        }
      }
    }
    
    return costOverrides;
  }
}