import { CardCost, ComparisonType, CostSpec } from 'shared/shared-types.ts';
import { isNumber } from 'es-toolkit/compat';

export const validateCostSpec = (validateAmount: CostSpec, cardCost: CardCost): boolean => {
  let validateAmountInTreasure: number;
  let validateAmountInPotions: number = 0;
  
  const costInTreasure = cardCost.treasure;
  const costInPotions = cardCost.potion ?? 0;
  
  const kind: ComparisonType = validateAmount.kind;
  
  if (isNumber(validateAmount.amount)) {
    validateAmountInTreasure = validateAmount.amount;
  }
  else {
    validateAmountInTreasure = validateAmount.amount.treasure;
    validateAmountInPotions = validateAmount.amount.potion ?? 0;
  }
  
  switch (kind) {
    case 'exact':
      return validateAmountInTreasure === costInTreasure && validateAmountInPotions === costInPotions;
    case 'upTo':
      return validateAmountInTreasure >= costInTreasure && validateAmountInPotions >= costInPotions;
    default:
      return false;
  }
};
