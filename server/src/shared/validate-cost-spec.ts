import { CostSpec } from "shared/types.ts";
import { isNumber } from 'es-toolkit/compat';

export const validateCostSpec = (spec: CostSpec, amount: number): boolean => {
  if (isNumber(spec)) {
    return amount === spec;
  }

  switch (spec.kind) {
    case "exact":
      return amount === spec.amount;
    case "upTo":
      return amount <= spec.amount;
    default:
      return false;
  }
};
