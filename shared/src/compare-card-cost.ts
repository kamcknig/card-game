import { CardCost } from './types/index.ts';

// Normalize a CardCost for multi-axis comparisons.
const normalizeCost = (cost: CardCost) => ({
  treasure: cost.treasure ?? 0,
  potion: cost.potion ?? 0,
  debt: cost.debt ?? 0,
});

// Compare two costs using Dominion's "costs more/less" rules across axes.
export const compareCardCosts = (left: CardCost, right: CardCost): -1 | 0 | 1 => {
  const leftCost = normalizeCost(left);
  const rightCost = normalizeCost(right);

  const leftAtLeast = leftCost.treasure >= rightCost.treasure
    && leftCost.potion >= rightCost.potion
    && leftCost.debt >= rightCost.debt;
  const rightAtLeast = rightCost.treasure >= leftCost.treasure
    && rightCost.potion >= leftCost.potion
    && rightCost.debt >= leftCost.debt;

  const leftStrictlyMore = leftAtLeast && (
    leftCost.treasure > rightCost.treasure
    || leftCost.potion > rightCost.potion
    || leftCost.debt > rightCost.debt
  );
  const rightStrictlyMore = rightAtLeast && (
    rightCost.treasure > leftCost.treasure
    || rightCost.potion > leftCost.potion
    || rightCost.debt > leftCost.debt
  );

  // When neither strictly dominates (including ties), treat as equal.
  if (!leftStrictlyMore && !rightStrictlyMore) {
    return 0;
  }

  return leftStrictlyMore ? 1 : -1;
};
