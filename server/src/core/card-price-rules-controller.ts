import { Card, CardCost, CardId, CardLike, Match, PlayerId } from 'shared/types/index.ts';
import { MatchCardLibrary } from './match-card-library.ts';

export type CardPriceRule = (
  card: CardLike,
  context: { match: Match; playerId: PlayerId },
) => {
  restricted: boolean;
  cost: CardCost;
  // When set, this rule's cost is the final cost for the card — every other
  // registered rule's additive cost delta is skipped for this evaluation
  // (still contributes to `restricted`). Used by effects whose card text
  // says a cost "overrides other cost-changing effects" (e.g. Wayfarer)
  // instead of stacking with them.
  overrideCost?: CardCost;
};

export class CardPriceRulesController {
  private _rules: Record<CardId, CardPriceRule[]> = {};

  constructor(
    private readonly cardLibrary: MatchCardLibrary,
    private readonly match: Match,
  ) {}

  /** Returns a shallow copy of the active price rule registry. */
  public snapshotRules(): Record<CardId, unknown[]> {
    const clone: Record<CardId, unknown[]> = {};
    for (const [cardId, rules] of Object.entries(this._rules)) {
      clone[Number(cardId)] = [...rules];
    }
    return clone;
  }

  /** Restores the price rule registry from a snapshot. */
  public restoreRules(snapshot: Record<CardId, unknown[]>): void {
    for (const key of Object.keys(this._rules)) {
      delete this._rules[Number(key)];
    }
    for (const [cardId, rules] of Object.entries(snapshot)) {
      this._rules[Number(cardId)] = [...rules] as typeof this._rules[CardId];
    }
  }

  registerRule(card: CardLike, rule: CardPriceRule) {
    this._rules[card.id] ??= [];
    this._rules[card.id].push(rule);

    return () => {
      const idx = this._rules[card.id].findIndex(r => r === rule);
      if (idx !== -1) {
        this._rules[card.id].splice(idx, 1);
      }
      return void 0;
    };
  }

  applyRules(card: CardLike, { playerId }: { playerId: PlayerId }) {
    let restricted = false;
    let modifiedCost = { ...card.cost };
    let overrideCost: CardCost | undefined;

    const rules = this._rules[card.id];
    if (!rules) {
      return { restricted, cost: modifiedCost };
    }

    for (const rule of rules) {
      const result = rule(card, { match: this.match, playerId });

      restricted ||= result.restricted;

      if (result.overrideCost) {
        // Last override wins; it replaces the additive accumulation entirely.
        overrideCost = result.overrideCost;
        continue;
      }

      modifiedCost = {
        treasure: Math.max(0, modifiedCost.treasure + (result.cost.treasure ?? 0)),
        potion: Math.max(0, (modifiedCost.potion ?? 0) + (result.cost.potion ?? 0)),
        // Debt is adjusted independently from treasure/potions.
        debt: Math.max(0, (modifiedCost.debt ?? 0) + (result.cost.debt ?? 0)),
      };
    }

    if (overrideCost) {
      return {
        restricted,
        cost: {
          treasure: Math.max(0, overrideCost.treasure),
          potion: Math.max(0, overrideCost.potion ?? 0),
          debt: Math.max(0, overrideCost.debt ?? 0),
        },
      };
    }

    return { restricted, cost: modifiedCost };
  }

  calculateOverrides() {
    const costOverrides: Record<PlayerId, Record<CardId, Partial<Card>>> = {};

    const cards = this.cardLibrary.getAllCardsAsArray();
    for (const player of this.match.players) {
      let hasOverrides = false;
      for (const card of cards) {
        const { cost, restricted } = this.applyRules(card, { playerId: player.id });
        const baseCost = card.cost;
        const costChanged =
          cost.treasure !== baseCost.treasure ||
          (cost.potion ?? 0) !== (baseCost.potion ?? 0) ||
          (cost.debt ?? 0) !== (baseCost.debt ?? 0);
        if (costChanged || restricted) {
          // Only store entries when a rule actually changes cost or restriction state.
          costOverrides[player.id] ??= {};
          costOverrides[player.id][card.id] = {
            cost,
          };
          hasOverrides = true;
        }
      }
      if (!hasOverrides) {
        delete costOverrides[player.id];
      }
    }

    return costOverrides;
  }
}
