import { castArray } from 'es-toolkit/compat';
import { isUndefined } from 'es-toolkit';
import { CardId, CardKey, CardLocation, CardType, CostSpec, isLocationMat, Match } from 'shared/shared-types.ts';

import { validateCostSpec } from '../shared/validate-cost-spec.ts';

import { CardLibrary } from '../core/card-library.ts';
import { CardPriceRulesController } from '../core/card-price-rules-controller.ts';
import { FindCardsFnFactory } from '../types.ts';

export type FindCardsFilter = {
  location?: CardLocation | CardLocation[];
  cost?: {
    spec: CostSpec
    cardCostController: CardPriceRulesController,
  };
  cards?: {
    tags?: string | string[];
    cardKeys?: CardKey | CardKey[];
    type?: CardType | CardType[];
  },
  owner?: number | undefined;
}

const findCardsByLocation = (match: Match, locations: CardLocation[]) => {
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

export const findCardsFactory: FindCardsFnFactory = (match: Match, cardLibrary: CardLibrary) => (filter: FindCardsFilter) => {
  let cardIds: CardId[] = [];
  
  if (filter.location) {
    filter.location = castArray(filter.location);
    cardIds = findCardsByLocation(match, filter.location);
  }
  else {
    cardIds = cardLibrary.getAllCardsAsArray().map(card => card.id);
  }
  
  let sourceCards = cardIds.map(cardLibrary.getCard);
  
  if (filter.owner) {
    sourceCards = sourceCards.filter(card => card.owner === filter.owner);
  }
  
  if (!isUndefined(filter.cards)) {
    if (!isUndefined(filter.cards?.cardKeys)) {
      const keys = castArray(filter.cards.cardKeys);
      sourceCards = sourceCards.filter(card => keys.includes(card.cardKey));
    }
    if (!isUndefined(filter.cards?.type)) {
      const types = castArray(filter.cards.type);
      sourceCards = sourceCards.filter(card => card.type.some(t => types.includes(t)));
    }
    
    if (!isUndefined(filter.cards?.tags)) {
      const tags = castArray(filter.cards.tags);
      sourceCards = sourceCards.filter(card => card.tags?.some(t => tags.includes(t)));
    }
  }
  
  if (filter.cost) {
    sourceCards = sourceCards.filter(card => {
      const { cost: effectiveCost } = filter.cost!.cardCostController.applyRules(card, {
        match,
        playerId: filter.cost!.spec.playerId
      });
      return validateCostSpec(filter.cost!.spec, effectiveCost);
    });
  }
  
  return sourceCards;
}
