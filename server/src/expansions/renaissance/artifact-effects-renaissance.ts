import { ArtifactEffectRegistrar } from '../../types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';

// Registers Renaissance artifact effects.
export const registerArtifactEffects = (registerArtifactEffect: ArtifactEffectRegistrar) => {
  // Register the Flag artifact effect.
  registerFlag(registerArtifactEffect);
};

// Registers the Flag artifact effect.
const registerFlag = (registerArtifactEffect: ArtifactEffectRegistrar) => {
  let drawHandTriggerId: string | undefined;

  registerArtifactEffect('flag', async ({
    playerId,
    match,
    reactionManager,
    cardId,
  }) => {
    const artifact = match.artifacts?.cards?.find(candidate => candidate.id === cardId);
    if (!artifact) {
      console.warn('[flag artifact] artifact card not found');
      return;
    }

    if (drawHandTriggerId) {
      reactionManager.unregisterTrigger(drawHandTriggerId);
      drawHandTriggerId = undefined;
    }

    console.info(`[flag artifact] registering triggers for player ${playerId}`);

    drawHandTriggerId = reactionManager.registerSystemTemplate(artifact, 'drawHand', {
      playerId,
      once: false,
      allowMultipleInstances: true,
      compulsory: true,
      condition: ({ trigger, match: triggerMatch }) => {
        if (trigger.args.playerId !== playerId) {
          return false;
        }
        if (getTurnPhase(triggerMatch.turnPhaseIndex) !== 'cleanup') {
          return false;
        }
        const ownedArtifacts = triggerMatch.artifacts?.byPlayer?.[playerId] ?? [];
        return ownedArtifacts.includes(cardId);
      },
      triggeredEffectFn: async ({ trigger, match: triggeredMatch, logManager }) => {
        trigger.args.count = Math.max(0, trigger.args.count + 1);
        // Log the Flag modifier as a nested reaction under the draw-hand entry.
        logManager.addLogEntry({
          type: 'cardLikeEffect',
          playerId,
          cardLikeId: cardId,
          effectText: '+1 Card',
        });
        console.debug(`[flag artifact] granting +1 card for hand draw on turn ${triggeredMatch.turnNumber}`);
      },
    });
  });
};
