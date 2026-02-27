import { Reaction } from '@server-types/index.ts';

export function buildActionMap(grouped: Map<string, { count: number; reaction: Reaction }>) {
  let actionId = 1;
  const map = new Map<number, Reaction>();
  for (const [, { reaction }] of grouped) {
    map.set(actionId++, reaction);
  }
  return map;
}
