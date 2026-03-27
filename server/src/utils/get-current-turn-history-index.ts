// Returns the active turn-history index from match stats.
// By default this returns 0 when no turns have been recorded yet.
export const getCurrentTurnHistoryIndex = (
  args: { match: { stats: { turns: unknown[] } } },
  options?: { fallbackToZero?: boolean },
): number | undefined => {
  const turnHistoryIndex = args.match.stats.turns.length - 1;
  if (turnHistoryIndex < 0) {
    return options?.fallbackToZero === false ? undefined : 0;
  }
  return turnHistoryIndex;
};
