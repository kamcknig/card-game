import { Reaction } from '../../types.ts';

export function groupReactionsByCardKey(reactions: Reaction[]) {
  const grouped = new Map<string, { count: number; reaction: Reaction }>();
  for (const reaction of reactions) {
    const key = reaction.getSourceKey();
    if (!grouped.has(key)) grouped.set(key, { count: 1, reaction });
    else grouped.get(key)!.count++;
  }
  return grouped;
}