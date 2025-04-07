import { Match } from "shared/shared-types.ts";
import { getCardOverrides } from "../card-data-overrides.ts";
import { CardLibrary } from '../core/card-library.ts';

export const getEffectiveCardCost = (
  playerId: number,
  cardId: number,
  match: Match,
  cardLibrary: CardLibrary,
) => {
  const overrides = getCardOverrides(match, cardLibrary);
  return overrides?.[playerId]?.[cardId]?.cost?.treasure ??
    cardLibrary.getCard(cardId).cost.treasure;
};
