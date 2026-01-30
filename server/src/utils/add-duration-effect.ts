import { Card } from 'shared/shared-types.ts';
import { CardEffectFunctionContext, DurationEffectOptions, ReactionTemplate, TriggerEventType } from '../types.ts';
import { getTurnPhase } from './get-turn-phase.ts';
import { castArray } from 'es-toolkit/compat';

/**
 * Adds a system event for the start of the cleanup phase to move the card to the activeDuration zone so that it's not
 * discarded
 *
 * also registers the given trigger to actually run the duration card's effect
 *
 * WARNING make sure to move the card back to the play area when its duration effect has completed. Usually this
 * will be done at the start of the next turn, but not always.
 *
 * WARNING duration triggers are not tied to card lifecycle events by default. Use the centralized duration
 * registration on the effect context to ensure they are cleaned when a card leaves play.
 */
export const addDurationEffect = <T extends TriggerEventType>(
  card: Card,
  context: CardEffectFunctionContext,
  triggeredTemplate: ReactionTemplate<T> | ReactionTemplate<T>[],
  options?: DurationEffectOptions,
): string[] => {
  const registeredTriggerIds: string[] = [];
  // Register cleanup handling to keep duration cards from being discarded.
  const cleanupCount = Math.max(0, options?.cleanupCount ?? 1);
  if (cleanupCount > 0) {
    let remainingCleanups = cleanupCount;
    let lastCleanupTurnNumber: number | null = null;
    const systemTriggerId = `${card.cardKey}:${card.id}:startTurnPhase:system`;
    context.reactionManager.registerSystemTemplate(card, 'startTurnPhase', {
      playerId: context.playerId,
      // Allow multi-turn duration cards to stay in play across multiple cleanups.
      once: cleanupCount === 1,
      allowMultipleInstances: true,
      condition: async (conditionArgs) => {
        const isCleanup = getTurnPhase(conditionArgs.trigger.args.phaseIndex) === 'cleanup';
        const isNewCleanup = lastCleanupTurnNumber !== conditionArgs.match.turnNumber;
        return isCleanup && isNewCleanup && remainingCleanups > 0;
      },
      triggeredEffectFn: async (triggeredArgs) => {
        console.debug(
          `[${card.cardKey} duration effect] moving to activeDuration zone`,
        );

        await triggeredArgs.runGameActionDelegate('moveCard', {
          cardId: card.id,
          to: { location: 'activeDuration' },
        });

        // Decrement remaining cleanups and unregister when finished.
        lastCleanupTurnNumber = triggeredArgs.match.turnNumber;
        remainingCleanups = Math.max(0, remainingCleanups - 1);
        if (remainingCleanups <= 0) {
          if (options?.autoRemoveTriggersOnExhaust) {
            triggeredArgs.reactionManager.cleanupDurationTriggers(card.id);
          } else {
            triggeredArgs.reactionManager.unregisterTrigger(triggeredArgs.reaction.id);
          }
        }
      },
    });
    registeredTriggerIds.push(systemTriggerId);
  }

  const templates = castArray(triggeredTemplate);

  // Register the trigger to run when the duration card triggers.
  for (const triggeredTemplateElement of templates) {
    context.reactionManager.registerReactionTemplate(triggeredTemplateElement);
    if (triggeredTemplateElement.id) {
      registeredTriggerIds.push(triggeredTemplateElement.id);
    }
  }

  return registeredTriggerIds;
};
