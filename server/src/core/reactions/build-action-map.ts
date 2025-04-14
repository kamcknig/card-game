import { Reaction } from '../../types.ts';

export function buildActionMap(
  grouped: Map<string, { count: number; reaction: Reaction }>,
) {
  let actionId = 1;
  const map = new Map<number, Reaction>();
  for (const [, { reaction }] of grouped) {
    map.set(actionId++, reaction);
  }
  return map;
}