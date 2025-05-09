import { castArray } from 'es-toolkit/compat';
import { isUndefined } from 'es-toolkit';
import { CardId, CardKey, CardLocation, CardType, CostSpec, Match, PlayerId } from 'shared/shared-types.ts';

import { validateCostSpec } from '../shared/validate-cost-spec.ts';
import { CardPriceRulesController } from '../core/card-price-rules-controller.ts';
import { FindCardsFnFactory } from '../types.ts';
import { CardSourceController } from '../core/card-source-controller.ts';

export type FindCardsFilter = {
  source?: {
    location: CardLocation | CardLocation[],
    playerId?: PlayerId;
  },
  cost?: {
    spec: CostSpec
    cardCostController: CardPriceRulesController,
  };
  cards?: {
    tags?: string | string[];
    cardKeys?: CardKey | CardKey[];
    type?: CardType | CardType[];
  },
  owner?: PlayerId | undefined;
}

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

export const findCardsFactory: FindCardsFnFactory = (cardSourceController, cardLibrary) => (filter: FindCardsFilter) => {
  let cardIds: CardId[] = [];
  
  if (filter.source) {
    filter.source.location = castArray(filter.source.location);
    cardIds = findCardsByLocation(filter.source.location, cardSourceController, filter.source.playerId);
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
        playerId: filter.cost!.spec.playerId
      });
      return validateCostSpec(filter.cost!.spec, effectiveCost);
    });
  }
  
  return sourceCards;
}
