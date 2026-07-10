import { Match, PlayerId } from 'shared/types/index.ts';
import type { ReactionContext } from '@server-types/index.ts';
import { findOrderedTargets } from './find-ordered-targets.ts';
import { isPlayerImmune } from './reaction-immunity.ts';

// Resolves the ordered list of attack targets for a card effect: every other
// player in turn order (starting just after `playerId`), minus anyone
// currently marked immune in the reaction scope (e.g. Moat). This is the
// ~63-site idiom of `findOrderedTargets({ appliesTo: 'ALL_OTHER' })` followed
// by a manual `.filter(!isPlayerImmune(...))` — forgetting the immune filter
// silently ignores Moat, so callers should prefer this helper over
// hand-rolling the two calls.
export const getAttackTargets = (
  match: Match,
  playerId: PlayerId,
  reactionContext: ReactionContext | undefined,
): PlayerId[] => {
  return findOrderedTargets({
    match,
    appliesTo: 'ALL_OTHER',
    startingPlayerId: playerId,
  }).filter(targetPlayerId => !isPlayerImmune(reactionContext, targetPlayerId));
};
