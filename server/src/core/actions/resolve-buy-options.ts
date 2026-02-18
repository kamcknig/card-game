import { Card, CardCost, CardId, Match, PlayerId } from 'shared/types/index.ts';
import { CardAlternateBuyOption, FindCardService } from '@server-types/index.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { CardSourceController } from '../card-source-controller.ts';
import { ExpansionEffectRegistryService } from '../expansion-effect-registry-service.ts';
import { LoggerService } from '../logger-service.ts';

// Normalized buy option result used by interactivity and buy execution.
export type ResolvedBuyOption = {
  id: string;
  label: string;
  kind: 'standard' | 'alternate';
  cost: CardCost;
  option?: CardAlternateBuyOption;
};

// Inputs for resolving all legal buy options for a card/player pair.
export type ResolveBuyOptionsArgs = {
  cardId: CardId | Card;
  playerId: PlayerId;
};

// Stringifies treasure/potion/debt cost for user-facing option labels.
const formatCostLabel = (cost: CardCost): string => {
  const parts: string[] = [];
  parts.push(`$${cost.treasure}`);
  if ((cost.potion ?? 0) > 0) {
    parts.push(`${cost.potion} potion`);
  }
  if ((cost.debt ?? 0) > 0) {
    parts.push(`${cost.debt} debt`);
  }
  return parts.join(', ');
};

export class BuyOptionsResolver {
  constructor(
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly cardSourceController: CardSourceController,
    private readonly findCardService: FindCardService,
    private readonly expansionEffectRegistryService: ExpansionEffectRegistryService,
    private readonly loggerService: LoggerService,
  ) {}

  // Resolves all currently legal ways the player can buy the card.
  public resolveBuyOptions(args: ResolveBuyOptionsArgs): {
    card: Card;
    cost: CardCost;
    options: ResolvedBuyOption[];
  } {
    const card = args.cardId instanceof Card ? args.cardId : this.cardLibrary.getCard(args.cardId);
    const { restricted, cost } = this.cardPriceController.applyRules(card, {
      playerId: args.playerId,
    });

    // Respect card-level canBuy gates before considering any payment method.
    const canBuyCondition = this.expansionEffectRegistryService.getCardActionConditions(card.cardKey)?.canBuy;
    if (
      canBuyCondition && !canBuyCondition({
        match: this.match,
        cardLibrary: this.cardLibrary,
        playerId: args.playerId,
      })
    ) {
      return { card, cost, options: [] };
    }

    const options: ResolvedBuyOption[] = [];

    // Standard payment is available only when normal treasure/potion affordability passes.
    if (
      !restricted &&
      cost.treasure <= this.match.playerTreasure &&
      (cost.potion === undefined || cost.potion <= this.match.playerPotions)
    ) {
      options.push({
        id: 'standard',
        label: `Pay ${formatCostLabel(cost)}`,
        kind: 'standard',
        cost,
      });
    }

    // Alternate options are card-specific and can add additional legal buy paths.
    const alternateOptions = this.expansionEffectRegistryService.getCardAlternateBuyOptions(card.cardKey);
    for (const option of alternateOptions) {
      if (
        !option.canBuy({
          match: this.match,
          playerId: args.playerId,
          card,
          cardLibrary: this.cardLibrary,
          findCardService: this.findCardService,
          cardSourceController: this.cardSourceController,
          cardPriceController: this.cardPriceController,
        })
      ) {
        continue;
      }

      // Skip duplicate option ids to keep prompt/result mapping deterministic.
      if (options.some((existingOption) => existingOption.id === option.id)) {
        this.loggerService.warn(
          `[buy options] duplicate buy option id '${option.id}' for ${card.cardKey}, skipping duplicate`,
        );
        continue;
      }

      options.push({
        id: option.id,
        label: option.label,
        kind: 'alternate',
        cost,
        option,
      });
    }

    return { card, cost, options };
  }
}
