import { CountSpec } from 'shared/shared-types';

// Validate a count against a CountSpec, supporting exact and upTo comparisons.
export const validateCountSpec = (spec: CountSpec, count: number): boolean => {
  // Treat a numeric CountSpec as an exact match.
  if (typeof spec === 'number') {
    return count === spec;
  }
  
  switch (spec.kind) {
    case 'upTo':
      return count <= spec.count;
    case 'exact':
      return count === spec.count;
    default:
      return false;
  }
};
