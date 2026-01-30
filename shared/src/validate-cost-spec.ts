import { CardCost, CostSpec } from 'shared/shared-types';

// Validate a card's cost against a CostSpec, supporting exact and upTo comparisons.
export const validateCostSpec = (validateAmount: CostSpec, cardCost: CardCost): boolean => {
  const costInTreasure = cardCost.treasure;
  const costInPotions = cardCost.potion ?? 0;
  // Debt is a separate cost axis that compares independently.
  const costInDebt = cardCost.debt ?? 0;
  
  // CostSpec always supplies a CardCost; normalize optional potion to 0.
  // Debt defaults to 0 unless specified in the CostSpec.
  const {
    treasure: validateAmountInTreasure,
    potion: validateAmountInPotions = 0,
    debt: validateAmountInDebt = 0,
  } = validateAmount.amount;
  
  switch (validateAmount.kind) {
    case 'exact':
      return validateAmountInTreasure === costInTreasure &&
        validateAmountInPotions === costInPotions &&
        validateAmountInDebt === costInDebt;
    case 'upTo':
      return validateAmountInTreasure >= costInTreasure &&
        validateAmountInPotions >= costInPotions &&
        validateAmountInDebt >= costInDebt;
    default:
      return false;
  }
};
