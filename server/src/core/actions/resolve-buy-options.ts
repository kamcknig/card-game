import { Card, CardCost, CardId, Match, PlayerId } from 'shared/types/index.ts';
import { CardAlternateBuyOption, FindCardsFn } from '@server-types/index.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { CardSourceController } from '../card-source-controller.ts';
import { cardActionConditionMapFactory } from './card-action-condition-map-factory.ts';
import { cardAlternateBuyOptionMapFactory } from './card-alternate-buy-option-map-factory.ts';

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
  match: Match;
  cardId: CardId | Card;
  playerId: PlayerId;
  cardLibrary: MatchCardLibrary;
  cardPriceController: CardPriceRulesController;
  cardSourceController: CardSourceController;
  findCards: FindCardsFn;
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

// Resolves all currently legal ways the player can buy the card.
export const resolveBuyOptions = (args: ResolveBuyOptionsArgs): {
  card: Card;
  cost: CardCost;
  options: ResolvedBuyOption[];
} => {
  const card = args.cardId instanceof Card ? args.cardId : args.cardLibrary.getCard(args.cardId);
  const { restricted, cost } = args.cardPriceController.applyRules(card, {
    playerId: args.playerId,
  });

  // Respect card-level canBuy gates before considering any payment method.
  const canBuyCondition = cardActionConditionMapFactory[card.cardKey]?.canBuy;
  if (
    canBuyCondition && !canBuyCondition({
      match: args.match,
      cardLibrary: args.cardLibrary,
      playerId: args.playerId,
    })
  ) {
    return { card, cost, options: [] };
  }

  const options: ResolvedBuyOption[] = [];

  // Standard payment is available only when normal treasure/potion affordability passes.
  if (
    !restricted &&
    cost.treasure <= args.match.playerTreasure &&
    (cost.potion === undefined || cost.potion <= args.match.playerPotions)
  ) {
    options.push({
      id: 'standard',
      label: `Pay ${formatCostLabel(cost)}`,
      kind: 'standard',
      cost,
    });
  }

  // Alternate options are card-specific and can add additional legal buy paths.
  const alternateOptions = cardAlternateBuyOptionMapFactory[card.cardKey] ?? [];
  for (const option of alternateOptions) {
    if (
      !option.canBuy({
        match: args.match,
        playerId: args.playerId,
        card,
        cardLibrary: args.cardLibrary,
        findCards: args.findCards,
        cardSourceController: args.cardSourceController,
        cardPriceController: args.cardPriceController,
      })
    ) {
      continue;
    }

    // Skip duplicate option ids to keep prompt/result mapping deterministic.
    if (options.some((existingOption) => existingOption.id === option.id)) {
      console.warn(`[buy options] duplicate buy option id '${option.id}' for ${card.cardKey}, skipping duplicate`);
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
};
