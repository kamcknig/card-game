import { CountSpec } from 'shared/shared-types';
import { isNumber } from 'es-toolkit/compat';

export const validateCountSpec = (spec: CountSpec, count: number): boolean => {
  if (isNumber(spec)) {
    return count === spec;
  }

  switch (spec.kind) {
    case 'upTo':
      return count > 0 && count <= spec.count;
    default:
      return false;
  }
}
