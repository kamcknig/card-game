import { ArtifactEffectRegistrar } from '@server-types/index.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { findArtifactInMatch } from '@shared/find-card-like-in-match.ts';
import { renaissanceArtifactKeys } from './artifact-keys-renaissance.ts';

// Registers Renaissance artifact effects.
export const registerArtifactEffects = (registerArtifactEffect: ArtifactEffectRegistrar) => {
  // Register the Flag artifact effect.
  registerFlag(registerArtifactEffect);
  // Register the Horn artifact effect.
  registerHorn(registerArtifactEffect);
  // Register the Key artifact effect.
  registerKey(registerArtifactEffect);
  // Register the Treasure Chest artifact effect.
  registerTreasureChest(registerArtifactEffect);
};

// Registers the Flag artifact effect.
const registerFlag = (registerArtifactEffect: ArtifactEffectRegistrar) => {
  let drawHandTriggerId: string | undefined;

  registerArtifactEffect(
    renaissanceArtifactKeys.flag,
    async ({ loggerService, playerId, match, reactionManager, cardId }) => {
      const artifact = findArtifactInMatch(match, cardId);
      if (!artifact) {
        loggerService.warn('[flag artifact] artifact card not found');
        return;
      }

      if (drawHandTriggerId) {
        reactionManager.unregisterTrigger(drawHandTriggerId);
        drawHandTriggerId = undefined;
      }

      loggerService.info(`[flag artifact] registering triggers for player ${playerId}`);

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
        triggeredEffectFn: async ({ loggerService, trigger, match: triggeredMatch, logManager }) => {
          trigger.args.count = Math.max(0, trigger.args.count + 1);
          // Log the Flag modifier as a nested reaction under the draw-hand entry.
          logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId,
            cardLikeId: cardId,
            effectText: '+1 Card',
          });
          loggerService.debug(`[flag artifact] granting +1 card for hand draw on turn ${triggeredMatch.turnNumber}`);
        },
      });
    },
  );
};

// Registers the Horn artifact effect.
const registerHorn = (registerArtifactEffect: ArtifactEffectRegistrar) => {
  let discardTriggerId: string | undefined;
  let lastUsedTurnHistoryIndex: number | undefined;

  registerArtifactEffect(
    renaissanceArtifactKeys.horn,
    async ({ loggerService, playerId, match, reactionManager, cardId }) => {
      const artifact = findArtifactInMatch(match, cardId);
      if (!artifact) {
        loggerService.warn('[horn artifact] artifact card not found');
        return;
      }

      // Clear any previous trigger when the Horn changes owners.
      if (discardTriggerId) {
        reactionManager.unregisterTrigger(discardTriggerId);
        discardTriggerId = undefined;
      }

      // Reset the once-per-turn tracker when reassigning the artifact.
      lastUsedTurnHistoryIndex = undefined;

      loggerService.info(`[horn artifact] registering triggers for player ${playerId}`);

      discardTriggerId = reactionManager.registerReactionTemplate(artifact, 'discardCard', {
        playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: false,
        condition: conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== playerId) return false;
          const currentTurnHistoryIndex = conditionArgs.match.stats.turns.length - 1;
          if (lastUsedTurnHistoryIndex === currentTurnHistoryIndex) return false;
          if (!isLocationInPlay(conditionArgs.trigger.args.previousLocation?.location)) return false;

          const discardedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (discardedCard.cardKey !== 'border-guard') return false;

          const ownedArtifacts = conditionArgs.match.artifacts?.byPlayer?.[playerId] ?? [];
          return ownedArtifacts.includes(cardId);
        },
        triggeredEffectFn: async triggeredArgs => {
          const discardedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          loggerService.debug(`[horn artifact] top-decking ${discardedCard}`);

          // Move the discarded Border Guard onto the top of the deck.
          await triggeredArgs.actionService.run('moveCard', {
            cardId: discardedCard.id,
            toPlayerId: playerId,
            to: { location: 'playerDeck' },
          });

          lastUsedTurnHistoryIndex = triggeredArgs.match.stats.turns.length - 1;
        },
      });
    },
  );
};

// Registers the Key artifact effect.
const registerKey = (registerArtifactEffect: ArtifactEffectRegistrar) => {
  let startTurnTriggerId: string | undefined;

  registerArtifactEffect(
    renaissanceArtifactKeys.key,
    async ({ loggerService, playerId, match, reactionManager, cardId }) => {
      const artifact = findArtifactInMatch(match, cardId);
      if (!artifact) {
        loggerService.warn('[key artifact] artifact card not found');
        return;
      }

      // Clear any previous trigger when the Key changes owners.
      if (startTurnTriggerId) {
        reactionManager.unregisterTrigger(startTurnTriggerId);
        startTurnTriggerId = undefined;
      }

      loggerService.info(`[key artifact] registering triggers for player ${playerId}`);

      startTurnTriggerId = reactionManager.registerSystemTemplate(artifact, 'startTurn', {
        playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: ({ trigger, match: triggerMatch }) => {
          if (trigger.args.playerId !== playerId) {
            return false;
          }
          const ownedArtifacts = triggerMatch.artifacts?.byPlayer?.[playerId] ?? [];
          return ownedArtifacts.includes(cardId);
        },
        triggeredEffectFn: async ({ loggerService, logManager, actionService, match: triggeredMatch }) => {
          loggerService.debug(`[key artifact] granting +$1 on turn ${triggeredMatch.turnNumber}`);
          logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId,
            cardLikeId: cardId,
            effectText: '+$1',
          });
          await actionService.run('gainTreasure', { count: 1 });
        },
      });
    },
  );
};

// Registers the Treasure Chest artifact effect.
const registerTreasureChest = (registerArtifactEffect: ArtifactEffectRegistrar) => {
  let startTurnPhaseTriggerId: string | undefined;

  registerArtifactEffect(
    renaissanceArtifactKeys.treasureChest,
    async ({ loggerService, playerId, match, reactionManager, cardId, findCardService }) => {
      const artifact = findArtifactInMatch(match, cardId);
      if (!artifact) {
        loggerService.warn('[treasure-chest artifact] artifact card not found');
        return;
      }

      if (startTurnPhaseTriggerId) {
        reactionManager.unregisterTrigger(startTurnPhaseTriggerId);
        startTurnPhaseTriggerId = undefined;
      }

      loggerService.info(`[treasure-chest artifact] registering triggers for player ${playerId}`);

      startTurnPhaseTriggerId = reactionManager.registerSystemTemplate(artifact, 'startTurnPhase', {
        playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: conditionArgs => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
            return false;
          }
          if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
            return false;
          }
          const ownedArtifacts = conditionArgs.match.artifacts?.byPlayer?.[playerId] ?? [];
          return ownedArtifacts.includes(cardId);
        },
        triggeredEffectFn: async ({ loggerService, logManager, supplyGainService, match: triggeredMatch }) => {
          const gainedGoldId = await supplyGainService.gainTopSupplyCardForPileKey({
            playerId,
            pileKey: 'gold',
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'treasure-chest artifact',
          });
          if (!gainedGoldId) {
            loggerService.debug('[treasure-chest artifact] no Gold cards available in supply');
            return;
          }
          loggerService.debug(`[treasure-chest artifact] gaining Gold on turn ${triggeredMatch.turnNumber}`);
          logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId,
            cardLikeId: cardId,
            effectText: 'Gain a Gold',
          });
        },
      });
    },
  );
};
