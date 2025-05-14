import { castArray } from 'es-toolkit/compat';
import { CardId, CardLocation, PlayerId } from 'shared/shared-types.ts';

import { validateCostSpec } from '../shared/validate-cost-spec.ts';
import {
  FindCardsFnFactory,
  isCardDataFindCardsFilter,
  isCostFindCardsFilter,
  isSourceFindCardsFilter,
  NonLocationFilters,
  SourceFindCardsFilter
} from '../types.ts';
import { CardSourceController } from '../core/card-source-controller.ts';

const findCardsByLocation = (locations: CardLocation[], cardSourceController: CardSourceController, playerId?: PlayerId) => {
  let cardIds: CardId[] = [];
  
  for (const location of locations) {
    let source = cardSourceController.getSource(location, playerId);
    if (!source) {
      source = cardSourceController.getSource(location);
    }
    
    if (source) {
      cardIds = cardIds.concat(source);
    }
  }
  return cardIds;
}

export const findCardsFactory: FindCardsFnFactory = (cardSourceController, cardCostController, cardLibrary) => filters => {
  let cardIds: CardId[] = [];
  let locationFilter: SourceFindCardsFilter | undefined = undefined;
  let otherFilters: NonLocationFilters[] = [];
  
  if (!Array.isArray(filters)) {
    if (isSourceFindCardsFilter(filters)) {
      locationFilter = filters;
    }
    else {
      otherFilters = [filters];
    }
  }
  else {
    if (isSourceFindCardsFilter(filters[0])) {
      locationFilter = filters.shift() as SourceFindCardsFilter;
      otherFilters = [...filters as NonLocationFilters[]];
    }
    else {
      otherFilters = [...filters as NonLocationFilters[]];
    }
  }
  
  if (locationFilter) {
    locationFilter.location = castArray(locationFilter.location);
    cardIds = findCardsByLocation(locationFilter.location, cardSourceController, locationFilter.playerId);
  }
  else {
    cardIds = cardLibrary.getAllCardsAsArray().map(card => card.id);
  }
  
  let sourceCards = cardIds.map(cardLibrary.getCard);
  
  for (const otherFilter of otherFilters) {
    if (isCardDataFindCardsFilter(otherFilter)) {
      if (otherFilter.tags) {
        sourceCards = sourceCards.filter(card => card.tags?.some(t => otherFilter.tags!.includes(t)));
      }
      
      if (otherFilter.kingdom) {
        sourceCards = sourceCards.filter(card => card.kingdom === otherFilter.kingdom);
      }
      
      if (otherFilter.cardKeys) {
        sourceCards = sourceCards.filter(card => otherFilter.cardKeys!.includes(card.cardKey));
      }
      if (otherFilter.owner) {
        sourceCards = sourceCards.filter(card => card.owner === otherFilter.owner);
      }
      if (otherFilter.cardType) {
        sourceCards = sourceCards.filter(card => card.type.some(t => otherFilter.cardType!.includes(t)));
      }
    }
    else if (isCostFindCardsFilter(otherFilter)) {
      sourceCards = sourceCards.filter(card => {
        const { cost: effectiveCost } = cardCostController.applyRules(card, {
          playerId: otherFilter.playerId
        });
        return validateCostSpec(otherFilter, effectiveCost);
      });
    }
  }
  
  return sourceCards;
}
