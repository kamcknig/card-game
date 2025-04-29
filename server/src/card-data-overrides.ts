import { Card, Match } from 'shared/shared-types.ts';
import { CardLibrary } from './core/card-library.ts';
import { CardOverrides, ModifyActionCardArgs } from './types.ts';
import { GameActionController } from './core/effects/game-action-controller.ts';

// todo should this be a class or at least an encapsulated object? if push an effect onto the stack
// it can auto send the socket updates. right now anywhere the code adds one or uses
// 'removeOverrideEffects' the consumer has to send them

export const cardDataOverrides: {
  targets: number[],
  overrideEffect: Parameters<GameActionController['modifyCost']>[0]
}[] = [];

export const removeOverrideEffects = (expiresAt: ModifyActionCardArgs['expiresAt']) => {
  for (let i = cardDataOverrides.length - 1; i >= 0; i--) {
    if (cardDataOverrides[i].overrideEffect.expiresAt === expiresAt) {
      cardDataOverrides.splice(i, 1);
    }
  }
};

export const getCardOverrides = (_match: Match, cardLibrary: CardLibrary): CardOverrides | undefined => {
  const overrides: CardOverrides = {};
  
  for (const override of cardDataOverrides) {
    for (const playerTargetId of override.targets) {
      overrides[playerTargetId] ??= {};
      
      const effect = override.overrideEffect;
      
      const allCards = Object.values(cardLibrary.getAllCards());
      
      let effectedCards: Card[] = [];
      if (typeof effect.appliesToCard === 'function') {
        effectedCards = allCards.filter(effect.appliesToCard);
      }
      else if (effect.appliesToCard === 'ALL') {
        effectedCards = allCards;
      }
      
      for (const effectedCard of effectedCards) {
        let existingOverrideCard = overrides[playerTargetId][effectedCard.id] ?? { cost: { treasure: Math.max(0, effectedCard.cost.treasure) } };
        
        existingOverrideCard = {
          ...existingOverrideCard,
          cost: {
            treasure: Math.max(0, existingOverrideCard.cost.treasure - 1)
          }
        }
        
        overrides[playerTargetId][effectedCard.id] = existingOverrideCard;
      }
    }
  }
  return overrides;
}