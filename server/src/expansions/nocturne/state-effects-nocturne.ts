import { StateEffectRegistrar } from '../../types.ts';
import { CardId } from 'shared/shared-types';

// Registers all state effects for the current match.
export const registerStateEffects = (registerStateEffect: StateEffectRegistrar) => {
  // Register Lost in the Woods state effect.
  registerLostInTheWoods(registerStateEffect);
};

// Registers Lost in the Woods state effect logic.
const registerLostInTheWoods = (registerStateEffect: StateEffectRegistrar) => {
  registerStateEffect('lost-in-the-woods', async ({
    playerId,
    match,
    reactionManager,
    runGameActionDelegate,
    cardId,
    cardSourceController,
  }) => {
    const state = match.states?.cards?.find(candidate => candidate.id === cardId);
    if (!state) {
      console.warn('[lost-in-the-woods state] state card not found');
      return;
    }

    const triggerId = `state:${state.id}:startTurn:${playerId}`;
    reactionManager.unregisterTrigger(triggerId);

    reactionManager.registerReactionTemplate(state, 'startTurn', {
      id: triggerId,
      playerId,
      once: false,
      allowMultipleInstances: true,
      compulsory: false,
      condition: (conditionArgs) => {
        if (conditionArgs.trigger.args.playerId !== playerId) {
          return false;
        }
        const ownedStates = conditionArgs.match.states?.byPlayer?.[playerId] ?? [];
        return ownedStates.includes(state.id);
      },
      triggeredEffectFn: async (triggeredArgs) => {
        const hand = cardSourceController.getSource('playerHand', playerId);
        if (!hand.length) {
          console.debug('[lost-in-the-woods state] no cards in hand to discard');
          return;
        }

        // Ask whether the player wants to discard for a boon.
        const decision = await runGameActionDelegate('userPrompt', {
          playerId,
          prompt: 'Discard a card to receive a Boon?',
          actionButtons: [
            { label: 'CANCEL', action: 1 },
            { label: 'DISCARD', action: 2 },
          ],
        }) as { action: number };

        if (decision.action !== 2) {
          console.debug('[lost-in-the-woods state] player declined to discard');
          return;
        }

        const selectedCardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Discard a card',
          playerId,
          count: 1,
          restrict: hand,
        }) as CardId[];

        const selectedCardId = selectedCardIds[0];
        if (!selectedCardId) {
          console.debug('[lost-in-the-woods state] no card selected to discard');
          return;
        }

        // Discard the chosen card and receive a boon.
        console.debug(`[lost-in-the-woods state] discarding ${selectedCardId}`);
        await runGameActionDelegate('discardCard', {
          playerId,
          cardId: selectedCardId,
        });

        console.debug('[lost-in-the-woods state] receiving a boon');
        await runGameActionDelegate('receiveBoon', {
          playerId,
        });
      },
    });
  });
};
