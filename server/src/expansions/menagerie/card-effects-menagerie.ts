import { CardExpansionModule } from '@server-types/index.ts';
import { CardId } from 'shared/types/index.ts';
import { getRemainingSupplyCount, getStartingSupplyCount } from '../../utils/get-starting-supply-count.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';

const expansion: CardExpansionModule = {
  'animal-fair': {
    // Register Animal Fair's alternate buy method: trash an Action from hand instead of paying treasure.
    registerAlternateBuyOptions: () => [{
      id: 'trash-action',
      label: 'Trash an Action from your hand',
      canBuy: ({ cardSourceController, cardLibrary, playerId }) => {
        // The alternate payment is legal only if the player currently has an Action in hand.
        return cardSourceController.getSource('playerHand', playerId)
          .some((cardId) => cardLibrary.getCard(cardId).type.includes('ACTION'));
      },
      apply: async ({ playerId, runGameActionDelegate }) => {
        // Prompt for the Action to trash as payment.
        const selectedCardIds = await runGameActionDelegate('selectCard', {
          playerId,
          prompt: 'Choose an Action card from your hand to trash for Animal Fair',
          restrict: [
            { location: 'playerHand', playerId },
            { cardType: 'ACTION' },
          ],
          count: 1,
        }) as CardId[];

        if (selectedCardIds.length === 0) {
          // Abort the buy if payment could not be completed.
          return { successful: false, paidTreasure: 0 };
        }

        // Trashing resolves before gain effects because this happens during payment.
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId: selectedCardIds[0],
        });

        return { successful: true, paidTreasure: 0 };
      },
    }],
    registerEffects: () => async (effectArgs) => {
      // Count only supply piles, matching Dominion's Animal Fair FAQ.
      const emptySupplyPiles = getStartingSupplyCount(effectArgs.match) - getRemainingSupplyCount(effectArgs.findCards);

      console.debug(
        `[animal-fair effect] gaining 4 treasure and ${emptySupplyPiles} buy(s) based on empty supply piles`,
      );

      await effectArgs.runGameActionDelegate('gainTreasure', {
        count: 4,
      });

      if (emptySupplyPiles > 0) {
        // Only grant buys when there are empty supply piles to count.
        await effectArgs.runGameActionDelegate('gainBuy', {
          count: emptySupplyPiles,
        });
      }
    },
  },
  'barge': {
    registerEffects: () => async (cardEffectArgs) => {
      // Prompt for immediate effect vs delayed duration effect.
      const choice = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Use Barge now or at the start of your next turn?',
        actionButtons: [
          { label: 'NOW', action: 1 },
          { label: 'NEXT TURN', action: 2 },
        ],
      }) as { action?: number } | null;

      if (choice?.action !== 2) {
        // Immediate mode: resolve +3 Cards and +1 Buy now.
        console.debug('[barge effect] resolving immediate mode');
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 3,
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
        return;
      }

      const bargeCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnHistoryIndex] ?? [];
      const bargePlayInstance = playedThisTurn.filter((playedCardId) => playedCardId === cardEffectArgs.cardId).length;
      // Include the play-instance suffix so replayed Barge effects do not collide.
      const delayedTriggerId = `barge:${cardEffectArgs.cardId}:startTurn:${bargePlayInstance}`;

      console.debug(`[barge effect] registering delayed mode trigger ${delayedTriggerId}`);
      cardEffectArgs.registerDurationEffect(bargeCard, {
        id: delayedTriggerId,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger, reaction }) =>
          trigger.args.playerId === cardEffectArgs.playerId && reaction.id === delayedTriggerId,
        triggeredEffectFn: async (triggeredArgs) => {
          // Move the duration card back into play as its next-turn effect resolves.
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: bargeCard.id,
            to: { location: 'playArea' },
          });

          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 3,
          });
          await triggeredArgs.runGameActionDelegate('gainBuy', { count: 1 });
        },
      });
    },
  },
  'black-cat': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ reactionManager, cardLibrary }, { playerId, cardId }) => {
        const blackCatCard = cardLibrary.getCard(cardId);

        reactionManager.registerReactionTemplate(blackCatCard, 'cardGained', {
          playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: ({ trigger, cardLibrary: triggerCardLibrary, cardSourceController }) => {
            // Black Cat can react only to another player's gain of a Victory card.
            if (trigger.args.playerId === playerId) {
              return false;
            }

            const gainedCard = triggerCardLibrary.getCard(trigger.args.cardId);
            if (!gainedCard.type.includes('VICTORY')) {
              return false;
            }

            // Guard against stale triggers by requiring this card to still be in hand.
            try {
              const source = cardSourceController.findCardSource(cardId);
              return source.sourceKey === 'playerHand' && source.playerId === playerId;
            } catch {
              return false;
            }
          },
          triggeredEffectFn: async (triggeredArgs) => {
            // Prompt since this reaction is optional ("you may play this").
            const promptResult = await triggeredArgs.runGameActionDelegate('userPrompt', {
              playerId,
              prompt: 'Play Black Cat?',
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'YES', action: 2 },
              ],
            }) as { action?: number } | null;

            if (promptResult?.action !== 2) {
              console.debug('[black-cat reaction] player declined to play Black Cat');
              return;
            }

            // Re-check location before playing to handle nested reaction ordering safely.
            try {
              const source = triggeredArgs.cardSourceController.findCardSource(cardId);
              if (source.sourceKey !== 'playerHand' || source.playerId !== playerId) {
                console.debug('[black-cat reaction] card is no longer in hand, skipping play');
                return;
              }
            } catch {
              console.debug('[black-cat reaction] card source not found, skipping play');
              return;
            }

            await triggeredArgs.runGameActionDelegate('playCard', {
              playerId,
              cardId,
              overrides: {
                actionCost: 0,
              },
            });
          },
        });
      },
      onLeaveHand: async ({ reactionManager, cardLibrary }, { cardId }) => {
        const blackCatCard = cardLibrary.getCard(cardId);
        reactionManager.unregisterTrigger(`${blackCatCard.cardName}:${cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      // Black Cat always draws +2 Cards first.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });

      const currentTurnPlayerId = getCurrentPlayer(cardEffectArgs.match).id;
      if (currentTurnPlayerId === cardEffectArgs.playerId) {
        // During your own turn, Black Cat has no attack effect.
        console.debug('[black-cat effect] current turn belongs to Black Cat owner; skipping curse attack');
        return;
      }

      // On another player's turn, each other player gains a Curse in turn order from the active turn player.
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: currentTurnPlayerId,
        appliesTo: 'ALL',
        match: cardEffectArgs.match,
      }).filter((targetPlayerId) =>
        targetPlayerId !== cardEffectArgs.playerId &&
        !isPlayerImmune(cardEffectArgs.reactionContext, targetPlayerId)
      );

      console.debug(`[black-cat effect] curse targets ${targetPlayerIds.join(', ')}`);
      for (const targetPlayerId of targetPlayerIds) {
        const curseCards = cardEffectArgs.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'curse' },
        ]);

        if (!curseCards.length) {
          console.debug('[black-cat effect] no Curse remaining in supply');
          return;
        }

        const curseCard = curseCards.slice(-1)[0];
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: targetPlayerId,
          cardId: curseCard.id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'bounty-hunter': {
    registerEffects: () => async (cardEffectArgs) => {
      // Bounty Hunter starts with +1 Action.
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        // If no card can be exiled, +$3 is not granted.
        console.debug('[bounty-hunter effect] no cards in hand to exile');
        return;
      }

      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a card from your hand to Exile',
        restrict: hand,
        count: 1,
      }) as CardId[];

      const selectedCardId = selectedCardIds[0];
      if (selectedCardId === undefined) {
        console.debug('[bounty-hunter effect] no card selected to exile');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      let exileCards: CardId[] = [];
      try {
        exileCards = cardEffectArgs.cardSourceController.getSource('exile', cardEffectArgs.playerId);
      } catch {
        console.warn('[bounty-hunter effect] exile mat not configured; skipping exile');
        return;
      }

      const hadCopyInExile = exileCards.some((cardId) =>
        cardEffectArgs.cardLibrary.getCard(cardId).cardKey === selectedCard.cardKey
      );

      console.debug(`[bounty-hunter effect] exiling ${selectedCard}`);
      await cardEffectArgs.runGameActionDelegate('exileCard', {
        cardId: selectedCard.id,
        playerId: cardEffectArgs.playerId,
      });

      if (hadCopyInExile) {
        console.debug('[bounty-hunter effect] copy already in Exile, no treasure gained');
        return;
      }

      console.debug('[bounty-hunter effect] no copy in Exile before move, gaining +3 treasure');
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 3 });
    },
  },
};

export default expansion;
