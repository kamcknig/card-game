import { castArray } from 'es-toolkit/compat';
import { isUndefined } from 'es-toolkit';
import { EffectRestrictionSpec, Match } from 'shared/shared-types.ts';

import { validateCostSpec } from '../shared/validate-cost-spec.ts';

import { CardLibrary } from '../core/card-library.ts';
import { getEffectiveCardCost } from './get-effective-card-cost.ts';

export const findCards = (
  match: Match,
  effectRestriction: EffectRestrictionSpec,
  cardLibrary: CardLibrary,
  playerId?: number,
) => {
  let cardIds: number[] = [];
  
  if (!isUndefined(effectRestriction.from?.location)) {
    if (!isUndefined(playerId)) {
      if (effectRestriction.from?.location.includes('playerHands')) {
        cardIds = cardIds.concat(match.playerHands[playerId]);
      }
      
      if (effectRestriction.from?.location.includes('playerDecks')) {
        cardIds = cardIds.concat(match.playerDecks[playerId]);
      }
      
      if (effectRestriction.from?.location.includes('playerDiscards')) {
        cardIds = cardIds.concat(match.playerDiscards[playerId]);
      }
    }
    
    if (effectRestriction.from?.location.includes('supply')) {
      cardIds = cardIds.concat(match.basicSupply);
    }
    
    if (effectRestriction.from?.location.includes('kingdom')) {
      cardIds = cardIds.concat(match.kingdomSupply);
    }
  }
  
  if (!isUndefined(effectRestriction?.cost)) {
    cardIds = cardIds.filter(id => {
      const effectiveCost = getEffectiveCardCost(playerId!, id, match, cardLibrary);
      return validateCostSpec(effectRestriction.cost!, effectiveCost);
    });
  }
  if (!isUndefined(effectRestriction.card)) {
    if (!isUndefined(effectRestriction.card?.cardKeys)) {
      const keys = castArray(effectRestriction.card.cardKeys);
      cardIds = cardIds.filter(id => keys.includes(cardLibrary.getCard(id).cardKey))
    }
    if (!isUndefined(effectRestriction.card?.type)) {
      const types = castArray(effectRestriction.card.type);
      cardIds = cardIds.filter(id => cardLibrary.getCard(id).type.some(t => types.includes(t)));
    }
  }
  
  return cardIds;
}
