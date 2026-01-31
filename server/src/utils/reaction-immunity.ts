import { PlayerId, ReactionContext, ReactionTrigger } from '../types.ts';

// Read-only immunity check so attack effects do not need to inspect raw reaction payloads.
export function isPlayerImmune(reactionContext: ReactionContext | undefined, playerId: PlayerId): boolean {
  return reactionContext?.immunityByPlayerId?.[playerId] === true;
}

// Mark a player as immune for the current trigger scope.
export function markPlayerImmune(reactionContext: ReactionContext | undefined, playerId: PlayerId): void {
  if (!reactionContext) return;
  reactionContext.immunityByPlayerId ??= {};
  reactionContext.immunityByPlayerId[playerId] = true;
}

// Ensure immunity state does not leak across trigger scopes.
export function initImmunityScope(reactionContext: ReactionContext | undefined, trigger: ReactionTrigger): void {
  if (!reactionContext) return;
  const scope = trigger.toString();
  if (!reactionContext.immunityScope) {
    reactionContext.immunityScope = scope;
    console.debug(`[IMMUNITY] initialized scope ${scope}`);
    return;
  }
  if (reactionContext.immunityScope !== scope) {
    console.warn(`[IMMUNITY] reactionContext reused across triggers: ${reactionContext.immunityScope} -> ${scope}`);
  }
}
