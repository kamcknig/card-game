import { CountSpec } from './types/index.ts';

export type ResolvedCountSpec =
  | { kind: 'fixed'; count: number }
  | { kind: 'range'; min: number; max: number };

// Normalizes CountSpec into a fixed or range representation for UI consumers.
export const resolveCountSpec = (spec: CountSpec | undefined): ResolvedCountSpec => {
  // Default to a fixed count of 1 when no spec is provided.
  const resolvedSpec = spec ?? 1;
  if (typeof resolvedSpec === 'number') {
    return { kind: 'fixed', count: resolvedSpec };
  }

  if (resolvedSpec.kind === 'range') {
    return { kind: 'range', min: resolvedSpec.min, max: resolvedSpec.max };
  }

  return { kind: 'fixed', count: resolvedSpec.count };
};
