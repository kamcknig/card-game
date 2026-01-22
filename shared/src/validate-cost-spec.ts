import { CardCost, CostSpec } from 'shared/shared-types';

// Validate a card's cost against a CostSpec, supporting exact and upTo comparisons.
export const validateCostSpec = (validateAmount: CostSpec, cardCost: CardCost): boolean => {
  const costInTreasure = cardCost.treasure;
  const costInPotions = cardCost.potion ?? 0;
  
  // CostSpec always supplies a CardCost; normalize optional potion to 0.
  const { treasure: validateAmountInTreasure, potion: validateAmountInPotions = 0 } = validateAmount.amount;
  
  switch (validateAmount.kind) {
    case 'exact':
      return validateAmountInTreasure === costInTreasure && validateAmountInPotions === costInPotions;
    case 'upTo':
      return validateAmountInTreasure >= costInTreasure && validateAmountInPotions >= costInPotions;
    default:
      return false;
  }
};
