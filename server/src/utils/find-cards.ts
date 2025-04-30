import { castArray } from 'es-toolkit/compat';
import { isUndefined } from 'es-toolkit';
import { CardId, CardKey, CardLocation, CardType, CostSpec, isLocationMat, Match } from 'shared/shared-types.ts';

import { validateCostSpec } from '../shared/validate-cost-spec.ts';

import { CardLibrary } from '../core/card-library.ts';
import { getEffectiveCardCost } from './get-effective-card-cost.ts';

export type FindCardsFilter = {
  location?: CardLocation | CardLocation[];
  cost?: CostSpec;
  cards?: {
    cardKeys?: CardKey | CardKey[];
    type?: CardType | CardType[];
  }
}

export const findCardsByLocation = (match: Match, locations: CardLocation[]) => {
  let cardIds: CardId[] = [];
  
  for (const location of locations) {
    if (location.includes('playerHands')) {
      for (const player of match.config.players) {
        const playerHand = match.playerHands[player.id];
        cardIds = cardIds.concat(playerHand);
      }
    }
    
    if (location.includes('playerDecks')) {
      for (const player of match.config.players) {
        const playerDeck = match.playerDecks[player.id];
        cardIds = cardIds.concat(playerDeck);
      }
    }
    
    if (location.includes('playerDiscards')) {
      for (const player of match.config.players) {
        const playerDiscard = match.playerDiscards[player.id];
        cardIds = cardIds.concat(playerDiscard);
      }
    }
    
    if (location.includes('supply')) {
      cardIds = cardIds.concat(match.basicSupply);
    }
    
    if (location.includes('kingdom')) {
      cardIds = cardIds.concat(match.kingdomSupply);
    }
    
    if (isLocationMat(location)) {
      for (const player of match.config.players) {
        cardIds = cardIds.concat(match.mats[player.id][location]);
      }
    }
  }
  
  return cardIds;
}

export const findCards = (
  match: Match,
  filter: FindCardsFilter,
  cardLibrary: CardLibrary
): CardId[] => {
  let cardIds: CardId[] = [];
  
  if (filter.location) {
    filter.location = castArray(filter.location);
    cardIds = findCardsByLocation(match, filter.location);
  }
  else {
    cardIds = cardLibrary.getAllCardsAsArray().map(card => card.id);
  }
  
  if (!isUndefined(filter.cost)) {
    cardIds = cardIds.filter(id => {
      const effectiveCost = getEffectiveCardCost(filter.cost!.playerId, id, match, cardLibrary);
      return validateCostSpec(filter.cost!, effectiveCost);
    });
  }
  
  if (!isUndefined(filter.cards)) {
    if (!isUndefined(filter.cards?.cardKeys)) {
      const keys = castArray(filter.cards.cardKeys);
      cardIds = cardIds.filter(id => keys.includes(cardLibrary.getCard(id).cardKey))
    }
    if (!isUndefined(filter.cards?.type)) {
      const types = castArray(filter.cards.type);
      cardIds = cardIds.filter(id => cardLibrary.getCard(id).type.some(t => types.includes(t)));
    }
  }
  
  return cardIds;
}
