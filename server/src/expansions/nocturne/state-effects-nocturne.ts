import { StateEffectRegistrar } from '@server-types/index.ts';
import { Card, CardId } from 'shared/types/index.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { findStateInMatch } from '@shared/find-card-like-in-match.ts';

// Registers all state effects for the current match.
export const registerStateEffects = (registerStateEffect: StateEffectRegistrar) => {
  // Register Lost in the Woods state effect.
  registerLostInTheWoods(registerStateEffect);
  // Register Deluded state effect.
  registerDeluded(registerStateEffect);
  // Register Envious state effect.
  registerEnvious(registerStateEffect);
};

// Registers Lost in the Woods state effect logic.
const registerLostInTheWoods = (registerStateEffect: StateEffectRegistrar) => {
  let currentTriggerId: string;

  registerStateEffect('lost-in-the-woods', async ({
    playerId,
    match,
    reactionManager,
    runGameActionDelegate,
    cardId,
    cardSourceController,
  }) => {
    const state = findStateInMatch(match, cardId);
    if (!state) {
      console.warn('[lost-in-the-woods state] state card not found');
      return;
    }

    if (currentTriggerId) reactionManager.unregisterTrigger(currentTriggerId);

    currentTriggerId = reactionManager.registerReactionTemplate(state, 'startTurn', {
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

// Registers Deluded state effect logic.
const registerDeluded = (registerStateEffect: StateEffectRegistrar) => {
  registerStateEffect('deluded', async ({
    playerId,
    match,
    reactionManager,
    runGameActionDelegate,
    cardId,
    cardLibrary,
    cardPriceController,
  }) => {
    const state = findStateInMatch(match, cardId);
    if (!state) {
      console.warn('[deluded state] state card not found');
      return;
    }

    console.log(`[deluded state] registering buy-phase restriction for player ${playerId}`);

    // Register a one-time trigger to apply the buy restriction at the start of the buy phase.
    reactionManager.registerSystemTemplate(state, 'startTurnPhase', {
      playerId,
      once: true,
      allowMultipleInstances: true,
      compulsory: true,
      condition: (conditionArgs) => {
        if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
          return false;
        }
        if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
          return false;
        }
        const ownedStates = conditionArgs.match.states?.byPlayer?.[playerId] ?? [];
        return ownedStates.includes(state.id);
      },
      triggeredEffectFn: async () => {
        console.debug('[deluded state] entering buy phase, removing state and applying restriction');
        await runGameActionDelegate('removeState', {
          playerId,
          stateId: state.id,
        });

        const cards = cardLibrary.getAllCardsAsArray();
        const ruleUnsubs: (() => void)[] = [];

        // Restrict Action buys for the affected player during this buy phase only.
        const rule: CardPriceRule = (card, context) => {
          if (context.playerId !== playerId) {
            return { restricted: false, cost: { treasure: 0 } };
          }
          if (!(card instanceof Card)) {
            return { restricted: false, cost: { treasure: 0 } };
          }
          return {
            restricted: card.type.includes('ACTION'),
            cost: { treasure: 0 },
          };
        };

        for (const card of cards) {
          ruleUnsubs.push(cardPriceController.registerRule(card, rule));
        }

        console.debug('[deluded state] registered Action buy restrictions for buy phase');

        // Remove the restriction at the end of the buy phase.
        reactionManager.registerSystemTemplate(state, 'endTurnPhase', {
          playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId !== playerId) {
              return false;
            }
            return getTurnPhase(conditionArgs.trigger.args.phaseIndex) === 'buy';
          },
          triggeredEffectFn: async () => {
            console.debug('[deluded state] clearing buy restriction at end of buy phase');
            for (const unsub of ruleUnsubs) {
              unsub();
            }
          },
        });
      },
    });
  });
};

// Registers Envious state effect logic.
const registerEnvious = (registerStateEffect: StateEffectRegistrar) => {
  let startTurnPhaseTriggerId: string | undefined;
  let treasureGainTriggerId: string | undefined;
  let endTurnTriggerId: string | undefined;

  registerStateEffect('envious', async ({
    playerId,
    match,
    reactionManager,
    runGameActionDelegate,
    cardId,
    cardLibrary,
  }) => {
    const state = findStateInMatch(match, cardId);
    if (!state) {
      console.warn('[envious state] state card not found');
      return;
    }

    if (startTurnPhaseTriggerId) {
      reactionManager.unregisterTrigger(startTurnPhaseTriggerId);
      startTurnPhaseTriggerId = undefined;
    }

    startTurnPhaseTriggerId = reactionManager.registerSystemTemplate(state, 'startTurnPhase', {
      playerId,
      once: true,
      allowMultipleInstances: true,
      compulsory: true,
      condition: (conditionArgs) => {
        if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
          return false;
        }
        if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
          return false;
        }
        const ownedStates = conditionArgs.match.states?.byPlayer?.[playerId] ?? [];
        return ownedStates.includes(state.id);
      },
      triggeredEffectFn: async () => {
        console.debug('[envious state] entering buy phase, removing state and registering triggers');
        await runGameActionDelegate('removeState', {
          playerId,
          stateId: state.id,
        });

        if (treasureGainTriggerId) {
          reactionManager.unregisterTrigger(treasureGainTriggerId);
          treasureGainTriggerId = undefined;
        }
        if (endTurnTriggerId) {
          reactionManager.unregisterTrigger(endTurnTriggerId);
          endTurnTriggerId = undefined;
        }

        treasureGainTriggerId = reactionManager.registerSystemTemplate(state, 'treasureGain', {
          playerId,
          once: false,
          allowMultipleInstances: true,
          compulsory: true,
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId !== playerId) {
              return false;
            }
            if (getCurrentPlayer(conditionArgs.match).id !== playerId) {
              return false;
            }
            const sourceId = conditionArgs.trigger.args.source;
            if (!sourceId) {
              return false;
            }
            const sourceCard = conditionArgs.cardLibrary.getCard(sourceId);
            return sourceCard.cardKey === 'silver' || sourceCard.cardKey === 'gold';
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const sourceId = triggeredArgs.trigger.args.source;
            if (!sourceId) {
              return;
            }
            const sourceCard = cardLibrary.getCard(sourceId);
            console.debug(`[envious state] forcing ${sourceCard.cardKey} to produce $1`);
            triggeredArgs.trigger.args.count = 1;
          },
        });

        endTurnTriggerId = reactionManager.registerSystemTemplate(state, 'endTurn', {
          playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: (conditionArgs) => conditionArgs.trigger.args.playerId === playerId,
          triggeredEffectFn: async () => {
            console.debug('[envious state] clearing Envious triggers at end of turn');
            if (treasureGainTriggerId) {
              reactionManager.unregisterTrigger(treasureGainTriggerId);
              treasureGainTriggerId = undefined;
            }
            if (endTurnTriggerId) {
              reactionManager.unregisterTrigger(endTurnTriggerId);
              endTurnTriggerId = undefined;
            }
          },
        });
      },
    });
  });
};
