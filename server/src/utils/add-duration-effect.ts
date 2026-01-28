import { Card } from 'shared/shared-types.ts';
import { CardEffectFunctionContext, ReactionTemplate, TriggerEventType } from '../types.ts';
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
 * WARNING currently the reaction/trigger system doesn't hook into card lifecycle events. So when this card leaves play
 * the system doesn't currently auto-detect this and remove any triggers. so you must manually remove the trigger
 * in the onLeavePlay lifecycle hook of the card expansion
 */
export const addDurationEffect = <T extends TriggerEventType>(
  card: Card,
  context: CardEffectFunctionContext,
  triggeredTemplate: ReactionTemplate<T> | ReactionTemplate<T>[],
) => {
  // Register cleanup handling to keep duration cards from being discarded.
  context.reactionManager.registerSystemTemplate(card, 'startTurnPhase', {
    playerId: context.playerId,
    once: true,
    allowMultipleInstances: true,
    condition: async (conditionArgs) => getTurnPhase(conditionArgs.trigger.args.phaseIndex) === 'cleanup',
    triggeredEffectFn: async (triggeredArgs) => {
      console.debug(
        `[${card.cardKey} duration effect] moving to activeDuration zone`,
      );

      await triggeredArgs.runGameActionDelegate('moveCard', {
        cardId: card.id,
        to: { location: 'activeDuration' },
      });
    },
  });

  const templates = castArray(triggeredTemplate);

  // Register the trigger to run when the duration card triggers.
  for (const triggeredTemplateElement of templates) {
    context.reactionManager.registerReactionTemplate(triggeredTemplateElement);
  }
};
