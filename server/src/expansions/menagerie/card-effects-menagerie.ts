import { CardExpansionModule } from '@server-types/index.ts';
import { CardId } from 'shared/types/index.ts';
import { compareCardCosts } from '@shared/compare-card-cost.ts';
import { getPlayerStartingFrom } from '@shared/get-player-position-utils.ts';
import { getRemainingSupplyCount, getStartingSupplyCount } from '../../utils/get-starting-supply-count.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';

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
  'camel-train': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        // Camel Train always exiles a Gold from supply when gained.
        const goldCards = cardEffectArgs.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'gold' },
        ]);

        if (!goldCards.length) {
          console.debug('[camel-train onGained] no Gold in supply to exile');
          return;
        }

        const goldCard = goldCards.slice(-1)[0];
        console.debug(`[camel-train onGained] exiling ${goldCard}`);
        await cardEffectArgs.runGameActionDelegate('exileCard', {
          cardId: goldCard.id,
          playerId: eventArgs.playerId,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      // Camel Train exiles exactly one non-Victory card from supply when possible.
      const exileCandidates = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
      ]).filter((card) => !card.type.includes('VICTORY'));

      if (!exileCandidates.length) {
        console.debug('[camel-train effect] no non-Victory supply cards to exile');
        return;
      }

      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a non-Victory card from the Supply to Exile',
        restrict: exileCandidates.map((card) => card.id),
        count: 1,
      }) as CardId[];

      const selectedCardId = selectedCardIds[0];
      if (selectedCardId === undefined) {
        console.warn('[camel-train effect] no card selected to exile');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      console.debug(`[camel-train effect] exiling ${selectedCard}`);
      await cardEffectArgs.runGameActionDelegate('exileCard', {
        cardId: selectedCardId,
        playerId: cardEffectArgs.playerId,
      });
    },
  },
  'cardinal': {
    registerEffects: () => async (cardEffectArgs) => {
      // Cardinal grants +$2 before resolving its attack.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });

      // Attack each other player in turn order, respecting immunity reactions.
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      }).filter((targetPlayerId) => !isPlayerImmune(cardEffectArgs.reactionContext, targetPlayerId));

      for (const targetPlayerId of targetPlayerIds) {
        const revealedCardIds: CardId[] = [];

        // Reveal the top two cards, letting revealCard handle shuffle fallback.
        for (let index = 0; index < 2; index++) {
          const revealedCardId = await cardEffectArgs.runGameActionDelegate('revealCard', {
            playerId: targetPlayerId,
            source: 'playerDeck',
            moveToSetAside: true,
          });
          if (revealedCardId === undefined) {
            console.debug(`[cardinal effect] player ${targetPlayerId} has no more cards to reveal`);
            break;
          }
          revealedCardIds.push(revealedCardId);
        }

        if (!revealedCardIds.length) {
          continue;
        }

        // Eligible exile targets are revealed cards with treasure cost from $3 to $6 inclusive.
        const exileCandidateIds = revealedCardIds.filter((revealedCardId) => {
          const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
          const revealedCost = cardEffectArgs.cardPriceController.applyRules(revealedCard, {
            playerId: targetPlayerId,
          }).cost;
          return revealedCost.treasure >= 3 && revealedCost.treasure <= 6;
        });

        let exileCardId: CardId | undefined;
        if (exileCandidateIds.length === 1) {
          exileCardId = exileCandidateIds[0];
        } else if (exileCandidateIds.length > 1) {
          // When both cards are eligible, the attacked player chooses which one to exile.
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: 'Choose a revealed card to Exile',
            restrict: exileCandidateIds,
            count: 1,
          }) as CardId[];
          exileCardId = selectedCardIds[0];
        }

        if (exileCardId !== undefined) {
          const exileCard = cardEffectArgs.cardLibrary.getCard(exileCardId);
          console.debug(`[cardinal effect] player ${targetPlayerId} exiling ${exileCard}`);
          await cardEffectArgs.runGameActionDelegate('exileCard', {
            cardId: exileCardId,
            playerId: targetPlayerId,
          });
        }

        // Discard all other revealed cards that were not exiled.
        for (const revealedCardId of revealedCardIds) {
          if (revealedCardId === exileCardId) continue;
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            playerId: targetPlayerId,
            cardId: revealedCardId,
          });
        }
      }
    },
  },
  'cavalry': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        // Cavalry always gives +2 Cards and +1 Buy when gained.
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: eventArgs.playerId,
          count: 2,
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });

        // Return to Action phase only when gained on your own Buy phase.
        const currentPlayerId = getCurrentPlayer(cardEffectArgs.match).id;
        if (currentPlayerId !== eventArgs.playerId) {
          console.debug('[cavalry onGained] gained off-turn, skipping phase change');
          return;
        }

        if (getTurnPhase(cardEffectArgs.match.turnPhaseIndex) !== 'buy') {
          console.debug('[cavalry onGained] not in buy phase, skipping phase change');
          return;
        }

        await cardEffectArgs.runGameActionDelegate('setTurnPhase', {
          phase: 'action',
          playerId: eventArgs.playerId,
          endCurrentPhase: true,
          startNewPhase: true,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      // Cavalry gains two Horses from the Horse non-supply pile.
      for (let index = 0; index < 2; index++) {
        const horseCards = cardEffectArgs.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'horse' },
        ]);

        if (!horseCards.length) {
          console.debug('[cavalry effect] no Horse cards remain to gain');
          return;
        }

        const horseCard = horseCards.slice(-1)[0];
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: horseCard.id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'coven': {
    registerEffects: () => async (cardEffectArgs) => {
      // Coven grants +1 Action and +$2 before its attack.
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });

      // Each other player either exiles a Curse or discards all exiled Curses if none are available.
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      }).filter((targetPlayerId) => !isPlayerImmune(cardEffectArgs.reactionContext, targetPlayerId));

      for (const targetPlayerId of targetPlayerIds) {
        const curseCards = cardEffectArgs.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'curse' },
        ]);

        if (curseCards.length) {
          const curseCard = curseCards.slice(-1)[0];
          await cardEffectArgs.runGameActionDelegate('exileCard', {
            playerId: targetPlayerId,
            cardId: curseCard.id,
          });
          continue;
        }

        let exileCards: CardId[] = [];
        try {
          exileCards = cardEffectArgs.cardSourceController.getSource('exile', targetPlayerId);
        } catch {
          console.debug(`[coven effect] player ${targetPlayerId} has no exile zone`);
        }

        const exiledCurseIds = exileCards.filter((cardId) =>
          cardEffectArgs.cardLibrary.getCard(cardId).cardKey === 'curse'
        );

        for (const exiledCurseId of exiledCurseIds) {
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            playerId: targetPlayerId,
            cardId: exiledCurseId,
          });
        }
      }
    },
  },
  'destrier': {
    registerEffects: () => async (cardEffectArgs) => {
      // Destrier is a simple non-terminal draw action.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
    },
  },
  'displace': {
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        console.debug('[displace effect] no cards in hand to exile');
        return;
      }

      // Displace requires exiling one card from hand first.
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a card from your hand to Exile',
        restrict: hand,
        count: 1,
      }) as CardId[];

      const selectedCardId = selectedCardIds[0];
      if (selectedCardId === undefined) {
        console.warn('[displace effect] no card selected to exile');
        return;
      }

      const exiledCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const exiledCardCost = cardEffectArgs.cardPriceController.applyRules(exiledCard, {
        playerId: cardEffectArgs.playerId,
      }).cost;

      await cardEffectArgs.runGameActionDelegate('exileCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      // Gain a differently named card costing up to $2 more than the exiled card.
      const gainCandidates = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        {
          kind: 'upTo',
          playerId: cardEffectArgs.playerId,
          amount: {
            treasure: exiledCardCost.treasure + 2,
            potion: exiledCardCost.potion,
            debt: exiledCardCost.debt,
          },
        },
      ]).filter((card) => card.cardKey !== exiledCard.cardKey);

      if (!gainCandidates.length) {
        console.debug('[displace effect] no differently named cards are gainable');
        return;
      }

      const selectedGainCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain a differently named card costing up to $${exiledCardCost.treasure + 2}`,
        restrict: gainCandidates.map((card) => card.id),
        count: 1,
      }) as CardId[];

      const selectedGainCardId = selectedGainCardIds[0];
      if (selectedGainCardId === undefined) {
        console.warn('[displace effect] no card selected to gain');
        return;
      }

      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedGainCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'falconer': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ reactionManager, cardLibrary }, { playerId, cardId }) => {
        const falconerCard = cardLibrary.getCard(cardId);

        // Register the optional "play from hand" reaction while Falconer remains in hand.
        reactionManager.registerReactionTemplate(falconerCard, 'cardGained', {
          playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: ({ trigger, cardLibrary: triggerCardLibrary, cardSourceController }) => {
            const gainedCard = triggerCardLibrary.getCard(trigger.args.cardId);
            if (gainedCard.type.length < 2) {
              return false;
            }

            // Only keep this reaction active while this Falconer is still in hand.
            try {
              const source = cardSourceController.findCardSource(cardId);
              return source.sourceKey === 'playerHand' && source.playerId === playerId;
            } catch {
              return false;
            }
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const promptResult = await triggeredArgs.runGameActionDelegate('userPrompt', {
              playerId,
              prompt: 'Play Falconer?',
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'YES', action: 2 },
              ],
            }) as { action?: number } | null;

            if (promptResult?.action !== 2) {
              console.debug('[falconer reaction] player declined to play Falconer');
              return;
            }

            // Re-check location before playing in case another reaction moved this card.
            try {
              const source = triggeredArgs.cardSourceController.findCardSource(cardId);
              if (source.sourceKey !== 'playerHand' || source.playerId !== playerId) {
                console.debug('[falconer reaction] card is no longer in hand, skipping play');
                return;
              }
            } catch {
              console.debug('[falconer reaction] card source not found, skipping play');
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
        const falconerCard = cardLibrary.getCard(cardId);
        reactionManager.unregisterTrigger(`${falconerCard.cardName}:${cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const falconerCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const { cost: falconerCost } = cardEffectArgs.cardPriceController.applyRules(falconerCard, {
        playerId: cardEffectArgs.playerId,
      });

      // Falconer gains from Supply only, and only cards costing less than Falconer.
      const gainCandidates = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
      ]).filter((candidateCard) => {
        const { cost: candidateCost } = cardEffectArgs.cardPriceController.applyRules(candidateCard, {
          playerId: cardEffectArgs.playerId,
        });
        return compareCardCosts(candidateCost, falconerCost) === -1;
      });

      if (!gainCandidates.length) {
        console.debug('[falconer effect] no gainable Supply cards costing less than Falconer');
        return;
      }

      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card to your hand costing less than Falconer',
        restrict: gainCandidates.map((card) => card.id),
        count: 1,
      }) as CardId[];

      const selectedCardId = selectedCardIds[0];
      if (selectedCardId === undefined) {
        console.warn('[falconer effect] no card selected to gain');
        return;
      }

      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerHand' },
      });
    },
  },
  'fisherman': {
    registerEffects: () => async (cardEffectArgs) => {
      // Fisherman is a simple cantrip with +$1.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
    },
  },
  'gatekeeper': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager, cardLibrary }, { cardId }) => {
        const gatekeeperCard = cardLibrary.getCard(cardId);
        // Ensure the attack reaction is cleaned if Gatekeeper leaves play early.
        reactionManager.unregisterTrigger(`${gatekeeperCard.cardName}:${cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const gatekeeperCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Register the "until then" gain attack effect.
      const gainAttackTriggerId = cardEffectArgs.reactionManager.registerSystemTemplate(
        gatekeeperCard,
        'cardGained',
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, cardLibrary, cardSourceController }) => {
            const gainedPlayerId = trigger.args.playerId;
            if (gainedPlayerId === cardEffectArgs.playerId) {
              return false;
            }

            const gainedCard = cardLibrary.getCard(trigger.args.cardId);
            if (!gainedCard.type.includes('ACTION') && !gainedCard.type.includes('TREASURE')) {
              return false;
            }

            let exileCards: CardId[] = [];
            try {
              exileCards = cardSourceController.getSource('exile', gainedPlayerId);
            } catch {
              return false;
            }

            const hasExiledCopy = exileCards.some((exileCardId) =>
              cardLibrary.getCard(exileCardId).cardKey === gainedCard.cardKey
            );
            return !hasExiledCopy;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const gainedPlayerId = triggeredArgs.trigger.args.playerId;
            const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);

            if (isPlayerImmune(triggeredArgs.reactionContext, gainedPlayerId)) {
              console.debug(`[gatekeeper effect] player ${gainedPlayerId} is immune, skipping exile`);
              return;
            }

            // Stop-moving check: the card can only be exiled if it has not moved since being gained.
            const gainedLocation = triggeredArgs.trigger.args.gainedLocation;
            if (gainedLocation) {
              try {
                const currentSource = triggeredArgs.cardSourceController.findCardSource(gainedCard.id);
                if (
                  currentSource.sourceKey !== gainedLocation.location ||
                  currentSource.playerId !== gainedLocation.playerId
                ) {
                  console.debug(`[gatekeeper effect] gained card ${gainedCard} moved since gain, skipping exile`);
                  return;
                }
              } catch {
                console.debug(`[gatekeeper effect] gained card ${gainedCard} source not found, skipping exile`);
                return;
              }
            }

            let exileCards: CardId[] = [];
            try {
              exileCards = triggeredArgs.cardSourceController.getSource('exile', gainedPlayerId);
            } catch {
              console.debug(`[gatekeeper effect] player ${gainedPlayerId} has no exile zone`);
              return;
            }

            const hasExiledCopy = exileCards.some((exileCardId) =>
              triggeredArgs.cardLibrary.getCard(exileCardId).cardKey === gainedCard.cardKey
            );
            if (hasExiledCopy) {
              console.debug(`[gatekeeper effect] player ${gainedPlayerId} already has ${gainedCard.cardKey} in Exile`);
              return;
            }

            console.debug(`[gatekeeper effect] exiling gained card ${gainedCard} for player ${gainedPlayerId}`);
            await triggeredArgs.runGameActionDelegate('exileCard', {
              cardId: gainedCard.id,
              playerId: gainedPlayerId,
            });
          },
        },
      );

      // Duration trigger: at start of your next turn, +$3 and end the gain-attack effect immediately.
      cardEffectArgs.registerDurationEffect(gatekeeperCard, {
        id: `gatekeeper:${cardEffectArgs.cardId}:startTurn`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'startTurn',
        once: true,
        compulsory: true,
        system: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.reactionManager.unregisterTrigger(gainAttackTriggerId);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: gatekeeperCard.id,
            to: { location: 'playArea' },
          });
          await triggeredArgs.runGameActionDelegate('gainTreasure', { count: 3 });
        },
      });
    },
  },
  'goatherd': {
    registerEffects: () => async (cardEffectArgs) => {
      // Goatherd always gives +1 Action first.
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (hand.length > 0) {
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'You may trash a card from your hand',
          restrict: hand,
          count: 1,
          optional: true,
        }) as CardId[];

        const selectedCardId = selectedCardIds[0];
        if (selectedCardId !== undefined) {
          await cardEffectArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
          });
        }
      }

      // Count cards trashed by the player to your right on their most recent turn.
      const playerToRight = getPlayerStartingFrom({
        startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
        match: cardEffectArgs.match,
        distance: -1,
      });

      let rightPlayerLastTurnHistoryIndex: number | undefined;
      for (let turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 2; turnHistoryIndex >= 0; turnHistoryIndex--) {
        const turnStats = cardEffectArgs.match.stats.turns[turnHistoryIndex];
        if (turnStats?.playerId === playerToRight.id) {
          rightPlayerLastTurnHistoryIndex = turnHistoryIndex;
          break;
        }
      }

      if (rightPlayerLastTurnHistoryIndex === undefined) {
        console.debug('[goatherd effect] player to the right has no prior turn, drawing 0 cards');
        return;
      }

      const trashedOnRightPlayersLastTurn = (cardEffectArgs.match.stats.trashedCardsByTurn[rightPlayerLastTurnHistoryIndex] ??
        []).filter((trashedCardId) => {
        const trashedStats = cardEffectArgs.match.stats.trashedCards[trashedCardId];
        return trashedStats?.turnHistoryIndex === rightPlayerLastTurnHistoryIndex &&
          trashedStats.playerId === playerToRight.id;
      }).length;

      if (trashedOnRightPlayersLastTurn < 1) {
        console.debug('[goatherd effect] player to the right trashed 0 cards on their last turn');
        return;
      }

      console.debug(
        `[goatherd effect] drawing ${trashedOnRightPlayersLastTurn} card(s) based on right player's last turn trashes`,
      );
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: trashedOnRightPlayersLastTurn,
      });
    },
  },
  'horse': {
    registerEffects: () => async (cardEffectArgs) => {
      // Horse draws 2 cards and then returns itself to the Horse pile.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });

      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: cardEffectArgs.cardId,
        to: { location: 'nonSupplyCards' },
      });
    },
  },
};

export default expansion;
