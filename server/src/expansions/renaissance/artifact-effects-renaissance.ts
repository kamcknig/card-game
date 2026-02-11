import { ArtifactEffectRegistrar } from '../../types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';

// Registers Renaissance artifact effects.
export const registerArtifactEffects = (registerArtifactEffect: ArtifactEffectRegistrar) => {
  // Register the Flag artifact effect.
  registerFlag(registerArtifactEffect);
  // Register the Horn artifact effect.
  registerHorn(registerArtifactEffect);
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

// Registers the Horn artifact effect.
const registerHorn = (registerArtifactEffect: ArtifactEffectRegistrar) => {
  let discardTriggerId: string | undefined;
  let lastUsedTurnNumber: number | undefined;

  registerArtifactEffect('horn', async ({
    playerId,
    match,
    reactionManager,
    cardId,
  }) => {
    const artifact = match.artifacts?.cards?.find(candidate => candidate.id === cardId);
    if (!artifact) {
      console.warn('[horn artifact] artifact card not found');
      return;
    }

    // Clear any previous trigger when the Horn changes owners.
    if (discardTriggerId) {
      reactionManager.unregisterTrigger(discardTriggerId);
      discardTriggerId = undefined;
    }

    // Reset the once-per-turn tracker when reassigning the artifact.
    lastUsedTurnNumber = undefined;

    console.info(`[horn artifact] registering triggers for player ${playerId}`);

    discardTriggerId = reactionManager.registerReactionTemplate(artifact, 'discardCard', {
      playerId,
      once: false,
      allowMultipleInstances: true,
      compulsory: false,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) return false;
        if (lastUsedTurnNumber === conditionArgs.match.turnNumber) return false;
        if (!isLocationInPlay(conditionArgs.trigger.args.previousLocation?.location)) return false;

        const discardedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
        if (discardedCard.cardKey !== 'border-guard') return false;

        const ownedArtifacts = conditionArgs.match.artifacts?.byPlayer?.[playerId] ?? [];
        return ownedArtifacts.includes(cardId);
      },
      triggeredEffectFn: async (triggeredArgs) => {
        const discardedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
        console.debug(`[horn artifact] top-decking ${discardedCard}`);

        // Move the discarded Border Guard onto the top of the deck.
        await triggeredArgs.runGameActionDelegate('moveCard', {
          cardId: discardedCard.id,
          toPlayerId: playerId,
          to: { location: 'playerDeck' },
        });

        lastUsedTurnNumber = triggeredArgs.match.turnNumber;
      },
    });
  });
};
