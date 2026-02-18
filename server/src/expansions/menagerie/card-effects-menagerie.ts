import { CardExpansionModule } from '@server-types/index.ts';
import { CardId } from 'shared/types/index.ts';
import { compareCardCosts } from '@shared/compare-card-cost.ts';
import { getPlayerStartingFrom } from '@shared/get-player-position-utils.ts';
import { getStartingSupplyCount } from '../../utils/get-starting-supply-count.ts';
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
      apply: async ({ playerId, actionService }) => {
        // Prompt for the Action to trash as payment.
        const selectedCardId = await actionService.run('selectSingleCard', {
          playerId,
          prompt: 'Choose an Action card from your hand to trash for Animal Fair',
          restrict: [
            { location: 'playerHand', playerId },
            { cardType: 'ACTION' },
          ],
          count: 1,
        });

        if (!selectedCardId) {
          // Abort the buy if payment could not be completed.
          return { successful: false, paidTreasure: 0 };
        }

        // Trashing resolves before gain effects because this happens during payment.
        await actionService.run('trashCard', {
          playerId,
          cardId: selectedCardId,
        });

        return { successful: true, paidTreasure: 0 };
      },
    }],
    registerEffects: () => async (effectArgs) => {
      const loggerService = effectArgs.loggerService;
            // Count only supply piles, matching Dominion's Animal Fair FAQ.
      const emptySupplyPiles = getStartingSupplyCount(effectArgs.match) - effectArgs.findCardService.getRemainingSupplyCount();

      loggerService.debug(
        `[animal-fair effect] gaining 4 treasure and ${emptySupplyPiles} buy(s) based on empty supply piles`,
      );

      await effectArgs.actionService.run('gainTreasure', {
        count: 4,
      });

      if (emptySupplyPiles > 0) {
        // Only grant buys when there are empty supply piles to count.
        await effectArgs.actionService.run('gainBuy', {
          count: emptySupplyPiles,
        });
      }
    },
  },
  'barge': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Prompt for immediate effect vs delayed duration effect.
      const choice = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Use Barge now or at the start of your next turn?',
        actionButtons: [
          { label: 'NOW', action: 1 },
          { label: 'NEXT TURN', action: 2 },
        ],
      }) as { action?: number } | null;

      if (choice?.action !== 2) {
        // Immediate mode: resolve +3 Cards and +1 Buy now.
        loggerService.debug('[barge effect] resolving immediate mode');
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 3,
        });
        await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
        return;
      }

      const bargeCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnHistoryIndex] ?? [];
      const bargePlayInstance = playedThisTurn.filter((playedCardId) => playedCardId === cardEffectArgs.cardId).length;
      // Include the play-instance suffix so replayed Barge effects do not collide.
      const delayedTriggerId = `barge:${cardEffectArgs.cardId}:startTurn:${bargePlayInstance}`;

      loggerService.debug(`[barge effect] registering delayed mode trigger ${delayedTriggerId}`);
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
          await triggeredArgs.actionService.run('moveCard', {
            cardId: bargeCard.id,
            to: { location: 'playArea' },
          });

          await triggeredArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 3,
          });
          await triggeredArgs.actionService.run('gainBuy', { count: 1 });
        },
      });
    },
  },
  'black-cat': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ loggerService,  reactionManager, cardLibrary }, { playerId, cardId }) => {
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
            const promptResult = await triggeredArgs.actionService.run('userPrompt', {
              playerId,
              prompt: 'Play Black Cat?',
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'YES', action: 2 },
              ],
            }) as { action?: number } | null;

            if (promptResult?.action !== 2) {
              loggerService.debug('[black-cat reaction] player declined to play Black Cat');
              return;
            }

            // Re-check location before playing to handle nested reaction ordering safely.
            try {
              const source = triggeredArgs.cardSourceController.findCardSource(cardId);
              if (source.sourceKey !== 'playerHand' || source.playerId !== playerId) {
                loggerService.debug('[black-cat reaction] card is no longer in hand, skipping play');
                return;
              }
            } catch {
              loggerService.debug('[black-cat reaction] card source not found, skipping play');
              return;
            }

            await triggeredArgs.actionService.run('playCard', {
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
      const loggerService = cardEffectArgs.loggerService;
            // Black Cat always draws +2 Cards first.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });

      const currentTurnPlayerId = getCurrentPlayer(cardEffectArgs.match).id;
      if (currentTurnPlayerId === cardEffectArgs.playerId) {
        // During your own turn, Black Cat has no attack effect.
        loggerService.debug('[black-cat effect] current turn belongs to Black Cat owner; skipping curse attack');
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

      loggerService.debug(`[black-cat effect] curse targets ${targetPlayerIds.join(', ')}`);
      for (const targetPlayerId of targetPlayerIds) {
        const gainedCurseId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: targetPlayerId,
          pileKey: 'curse',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'black-cat effect',
        });
        if (!gainedCurseId) {
          loggerService.debug('[black-cat effect] no Curse remaining in supply');
          return;
        }
      }
    },
  },
  'bounty-hunter': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Bounty Hunter starts with +1 Action.
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        // If no card can be exiled, +$3 is not granted.
        loggerService.debug('[bounty-hunter effect] no cards in hand to exile');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a card from your hand to Exile',
        restrict: hand,
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.debug('[bounty-hunter effect] no card selected to exile');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      let exileCards: CardId[] = [];
      try {
        exileCards = cardEffectArgs.cardSourceController.getSource('exile', cardEffectArgs.playerId);
      } catch {
        loggerService.warn('[bounty-hunter effect] exile mat not configured; skipping exile');
        return;
      }

      const hadCopyInExile = exileCards.some((cardId) =>
        cardEffectArgs.cardLibrary.getCard(cardId).cardKey === selectedCard.cardKey
      );

      loggerService.debug(`[bounty-hunter effect] exiling ${selectedCard}`);
      await cardEffectArgs.actionService.run('exileCard', {
        cardId: selectedCard.id,
        playerId: cardEffectArgs.playerId,
      });

      if (hadCopyInExile) {
        loggerService.debug('[bounty-hunter effect] copy already in Exile, no treasure gained');
        return;
      }

      loggerService.debug('[bounty-hunter effect] no copy in Exile before move, gaining +3 treasure');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });
    },
  },
  'camel-train': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Camel Train always exiles a Gold from supply when gained.
        const goldCard = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({
          pileKey: 'gold',
          from: 'basicSupply',
        });
        if (!goldCard) {
          loggerService.debug('[camel-train onGained] no Gold in supply to exile');
          return;
        }

        loggerService.debug(`[camel-train onGained] exiling ${goldCard}`);
        await cardEffectArgs.actionService.run('exileCard', {
          cardId: goldCard.id,
          playerId: eventArgs.playerId,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Camel Train exiles exactly one non-Victory card from supply when possible.
      const exileCandidates = cardEffectArgs.findCardService.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
      ]).filter((card) => !card.type.includes('VICTORY'));

      if (!exileCandidates.length) {
        loggerService.debug('[camel-train effect] no non-Victory supply cards to exile');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a non-Victory card from the Supply to Exile',
        restrict: exileCandidates.map((card) => card.id),
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.warn('[camel-train effect] no card selected to exile');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      loggerService.debug(`[camel-train effect] exiling ${selectedCard}`);
      await cardEffectArgs.actionService.run('exileCard', {
        cardId: selectedCardId,
        playerId: cardEffectArgs.playerId,
      });
    },
  },
  'cardinal': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Cardinal grants +$2 before resolving its attack.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

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
          const revealedCardId = await cardEffectArgs.actionService.run('revealCard', {
            playerId: targetPlayerId,
            source: 'playerDeck',
            moveToSetAside: true,
          });
          if (revealedCardId === undefined) {
            loggerService.debug(`[cardinal effect] player ${targetPlayerId} has no more cards to reveal`);
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
          const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
            playerId: targetPlayerId,
            prompt: 'Choose a revealed card to Exile',
            restrict: exileCandidateIds,
            count: 1,
          });
          exileCardId = selectedCardId ?? undefined;
        }

        if (exileCardId !== undefined) {
          const exileCard = cardEffectArgs.cardLibrary.getCard(exileCardId);
          loggerService.debug(`[cardinal effect] player ${targetPlayerId} exiling ${exileCard}`);
          await cardEffectArgs.actionService.run('exileCard', {
            cardId: exileCardId,
            playerId: targetPlayerId,
          });
        }

        // Discard all other revealed cards that were not exiled.
        for (const revealedCardId of revealedCardIds) {
          if (revealedCardId === exileCardId) continue;
          await cardEffectArgs.actionService.run('discardCard', {
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
      const loggerService = cardEffectArgs.loggerService;
        // Cavalry always gives +2 Cards and +1 Buy when gained.
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: eventArgs.playerId,
          count: 2,
        });
        await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

        // Return to Action phase only when gained on your own Buy phase.
        const currentPlayerId = getCurrentPlayer(cardEffectArgs.match).id;
        if (currentPlayerId !== eventArgs.playerId) {
          loggerService.debug('[cavalry onGained] gained off-turn, skipping phase change');
          return;
        }

        if (getTurnPhase(cardEffectArgs.match.turnPhaseIndex) !== 'buy') {
          loggerService.debug('[cavalry onGained] not in buy phase, skipping phase change');
          return;
        }

        await cardEffectArgs.actionService.run('setTurnPhase', {
          phase: 'action',
          playerId: eventArgs.playerId,
          endCurrentPhase: true,
          startNewPhase: true,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Cavalry gains two Horses from the Horse non-supply pile.
      for (let index = 0; index < 2; index++) {
        const horseCards = cardEffectArgs.findCardService.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'horse' },
        ]);

        if (!horseCards.length) {
          loggerService.debug('[cavalry effect] no Horse cards remain to gain');
          return;
        }

        const horseCard = horseCards.slice(-1)[0];
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: horseCard.id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'coven': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Coven grants +1 Action and +$2 before its attack.
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      // Each other player either exiles a Curse or discards all exiled Curses if none are available.
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      }).filter((targetPlayerId) => !isPlayerImmune(cardEffectArgs.reactionContext, targetPlayerId));

      for (const targetPlayerId of targetPlayerIds) {
        const curseCards = cardEffectArgs.findCardService.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'curse' },
        ]);

        if (curseCards.length) {
          const curseCard = curseCards.slice(-1)[0];
          await cardEffectArgs.actionService.run('exileCard', {
            playerId: targetPlayerId,
            cardId: curseCard.id,
          });
          continue;
        }

        let exileCards: CardId[] = [];
        try {
          exileCards = cardEffectArgs.cardSourceController.getSource('exile', targetPlayerId);
        } catch {
          loggerService.debug(`[coven effect] player ${targetPlayerId} has no exile zone`);
        }

        const exiledCurseIds = exileCards.filter((cardId) =>
          cardEffectArgs.cardLibrary.getCard(cardId).cardKey === 'curse'
        );

        for (const exiledCurseId of exiledCurseIds) {
          await cardEffectArgs.actionService.run('discardCard', {
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
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
    },
  },
  'displace': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[displace effect] no cards in hand to exile');
        return;
      }

      // Displace requires exiling one card from hand first.
      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a card from your hand to Exile',
        restrict: hand,
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.warn('[displace effect] no card selected to exile');
        return;
      }

      const exiledCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const exiledCardCost = cardEffectArgs.cardPriceController.applyRules(exiledCard, {
        playerId: cardEffectArgs.playerId,
      }).cost;

      await cardEffectArgs.actionService.run('exileCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      // Gain a differently named card costing up to $2 more than the exiled card.
      const gainCandidates = cardEffectArgs.findCardService.findCards([
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
        loggerService.debug('[displace effect] no differently named cards are gainable');
        return;
      }

      const selectedGainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain a differently named card costing up to $${exiledCardCost.treasure + 2}`,
        restrict: gainCandidates.map((card) => card.id),
        count: 1,
      }) as CardId | null;
      if (!selectedGainCardId) {
        loggerService.warn('[displace effect] no card selected to gain');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedGainCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'falconer': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ loggerService,  reactionManager, cardLibrary }, { playerId, cardId }) => {
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
            const promptResult = await triggeredArgs.actionService.run('userPrompt', {
              playerId,
              prompt: 'Play Falconer?',
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'YES', action: 2 },
              ],
            }) as { action?: number } | null;

            if (promptResult?.action !== 2) {
              loggerService.debug('[falconer reaction] player declined to play Falconer');
              return;
            }

            // Re-check location before playing in case another reaction moved this card.
            try {
              const source = triggeredArgs.cardSourceController.findCardSource(cardId);
              if (source.sourceKey !== 'playerHand' || source.playerId !== playerId) {
                loggerService.debug('[falconer reaction] card is no longer in hand, skipping play');
                return;
              }
            } catch {
              loggerService.debug('[falconer reaction] card source not found, skipping play');
              return;
            }

            await triggeredArgs.actionService.run('playCard', {
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
      const loggerService = cardEffectArgs.loggerService;
            const falconerCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const { cost: falconerCost } = cardEffectArgs.cardPriceController.applyRules(falconerCard, {
        playerId: cardEffectArgs.playerId,
      });

      // Falconer gains from Supply only, and only cards costing less than Falconer.
      const gainCandidates = cardEffectArgs.findCardService.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
      ]).filter((candidateCard) => {
        const { cost: candidateCost } = cardEffectArgs.cardPriceController.applyRules(candidateCard, {
          playerId: cardEffectArgs.playerId,
        });
        return compareCardCosts(candidateCost, falconerCost) === -1;
      });

      if (!gainCandidates.length) {
        loggerService.debug('[falconer effect] no gainable Supply cards costing less than Falconer');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card to your hand costing less than Falconer',
        restrict: gainCandidates.map((card) => card.id),
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.warn('[falconer effect] no card selected to gain');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerHand' },
      });
    },
  },
  'fisherman': {
    registerEffects: () => async (cardEffectArgs) => {
            // Fisherman is a simple cantrip with +$1.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
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
      const loggerService = cardEffectArgs.loggerService;
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
              loggerService.debug(`[gatekeeper effect] player ${gainedPlayerId} is immune, skipping exile`);
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
                  loggerService.debug(`[gatekeeper effect] gained card ${gainedCard} moved since gain, skipping exile`);
                  return;
                }
              } catch {
                loggerService.debug(`[gatekeeper effect] gained card ${gainedCard} source not found, skipping exile`);
                return;
              }
            }

            let exileCards: CardId[] = [];
            try {
              exileCards = triggeredArgs.cardSourceController.getSource('exile', gainedPlayerId);
            } catch {
              loggerService.debug(`[gatekeeper effect] player ${gainedPlayerId} has no exile zone`);
              return;
            }

            const hasExiledCopy = exileCards.some((exileCardId) =>
              triggeredArgs.cardLibrary.getCard(exileCardId).cardKey === gainedCard.cardKey
            );
            if (hasExiledCopy) {
              loggerService.debug(`[gatekeeper effect] player ${gainedPlayerId} already has ${gainedCard.cardKey} in Exile`);
              return;
            }

            loggerService.debug(`[gatekeeper effect] exiling gained card ${gainedCard} for player ${gainedPlayerId}`);
            await triggeredArgs.actionService.run('exileCard', {
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
          await triggeredArgs.actionService.run('moveCard', {
            cardId: gatekeeperCard.id,
            to: { location: 'playArea' },
          });
          await triggeredArgs.actionService.run('gainTreasure', { count: 3 });
        },
      });
    },
  },
  'goatherd': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Goatherd always gives +1 Action first.
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (hand.length > 0) {
        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'You may trash a card from your hand',
          restrict: hand,
          count: 1,
          optional: true,
        }) as CardId | null;
      if (selectedCardId) {
        await cardEffectArgs.actionService.run('trashCard', {
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
        loggerService.debug('[goatherd effect] player to the right has no prior turn, drawing 0 cards');
        return;
      }

      const trashedOnRightPlayersLastTurn = (cardEffectArgs.match.stats.trashedCardsByTurn[rightPlayerLastTurnHistoryIndex] ??
        []).filter((trashedCardId) => {
        const trashedStats = cardEffectArgs.match.stats.trashedCards[trashedCardId];
        return trashedStats?.turnHistoryIndex === rightPlayerLastTurnHistoryIndex &&
          trashedStats.playerId === playerToRight.id;
      }).length;

      if (trashedOnRightPlayersLastTurn < 1) {
        loggerService.debug('[goatherd effect] player to the right trashed 0 cards on their last turn');
        return;
      }

      loggerService.debug(
        `[goatherd effect] drawing ${trashedOnRightPlayersLastTurn} card(s) based on right player's last turn trashes`,
      );
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: trashedOnRightPlayersLastTurn,
      });
    },
  },
  'groom': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Groom gains one card from the Supply costing up to $4.
      const gainableCards = cardEffectArgs.findCardService.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 4 } },
      ]);

      if (!gainableCards.length) {
        loggerService.debug('[groom effect] no gainable cards in supply costing up to 4');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card costing up to $4',
        restrict: gainableCards.map((card) => card.id),
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.warn('[groom effect] no card selected to gain');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      loggerService.debug(`[groom effect] gaining ${selectedCard}`);
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' },
      });

      // Groom bonuses are cumulative when a gained card has multiple relevant types.
      if (selectedCard.type.includes('ACTION')) {
        const horseCards = cardEffectArgs.findCardService.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'horse' },
        ]);

        if (!horseCards.length) {
          loggerService.debug('[groom effect] no Horse cards remain to gain for Action bonus');
        } else {
          const horseCard = horseCards.slice(-1)[0];
          loggerService.debug(`[groom effect] gained Action card, gaining Horse ${horseCard}`);
          await cardEffectArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: horseCard.id,
            to: { location: 'playerDiscard' },
          });
        }
      }

      if (selectedCard.type.includes('TREASURE')) {
        const gainedSilverId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: cardEffectArgs.playerId,
          pileKey: 'silver',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'groom effect',
        });
        if (!gainedSilverId) {
          loggerService.debug('[groom effect] no Silver cards remain to gain for Treasure bonus');
        } else {
          loggerService.debug(`[groom effect] gained Treasure card, gaining Silver ${gainedSilverId}`);
        }
      }

      if (selectedCard.type.includes('VICTORY')) {
        loggerService.debug('[groom effect] gained Victory card, drawing 1 and gaining 1 Action');
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 1,
        });
        await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      }
    },
  },
  'hostelry': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
      const loggerService = cardEffectArgs.loggerService;
        // Hostelry may discard any number of Treasures from hand when gained.
        const treasureInHand = cardEffectArgs.cardSourceController.getSource('playerHand', eventArgs.playerId)
          .filter((cardId) => cardEffectArgs.cardLibrary.getCard(cardId).type.includes('TREASURE'));

        if (!treasureInHand.length) {
          loggerService.debug('[hostelry onGained effect] no Treasures in hand to discard');
          return;
        }

        const selectedTreasureIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId: eventArgs.playerId,
          prompt: 'You may discard any number of Treasures to gain that many Horses',
          restrict: treasureInHand,
          count: { kind: 'upTo', count: treasureInHand.length },
          optional: true,
        });

        if (!selectedTreasureIds.length) {
          loggerService.debug('[hostelry onGained effect] no Treasures selected to discard');
          return;
        }

        // Revealing happens before discard per Hostelry FAQ text.
        for (const selectedTreasureId of selectedTreasureIds) {
          const revealedCard = cardEffectArgs.cardLibrary.getCard(selectedTreasureId);
          loggerService.debug(`[hostelry onGained effect] revealing ${revealedCard}`);
          await cardEffectArgs.actionService.run('revealCard', {
            playerId: eventArgs.playerId,
            cardId: selectedTreasureId,
          });
        }

        for (const selectedTreasureId of selectedTreasureIds) {
          const discardedCard = cardEffectArgs.cardLibrary.getCard(selectedTreasureId);
          loggerService.debug(`[hostelry onGained effect] discarding ${discardedCard}`);
          await cardEffectArgs.actionService.run('discardCard', {
            playerId: eventArgs.playerId,
            cardId: selectedTreasureId,
          });
        }

        // Gain one Horse per discarded Treasure from the Horse pile.
        for (let index = 0; index < selectedTreasureIds.length; index++) {
          const horseCards = cardEffectArgs.findCardService.findCards([
            { location: 'nonSupplyCards' },
            { cardKeys: 'horse' },
          ]);

          if (!horseCards.length) {
            loggerService.debug('[hostelry onGained effect] no Horse cards remain to gain');
            return;
          }

          const horseCard = horseCards.slice(-1)[0];
          await cardEffectArgs.actionService.run('gainCard', {
            playerId: eventArgs.playerId,
            cardId: horseCard.id,
            to: { location: 'playerDiscard' },
          });
        }
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
            // Hostelry is a +1 Card +2 Actions village.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
    },
  },
  'hunting-lodge': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Hunting Lodge always resolves +1 Card and +2 Actions first.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const promptResult = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Discard your hand for +5 Cards?',
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'YES', action: 2 },
        ],
      }) as { action?: number } | null;

      if (promptResult?.action !== 2) {
        loggerService.debug('[hunting-lodge effect] player declined to discard hand');
        return;
      }

      // Discard the full hand at resolution time, then draw 5.
      const hand = [...cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId)];
      loggerService.debug(`[hunting-lodge effect] discarding ${hand.length} card(s) from hand`);
      for (const cardId of hand) {
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      loggerService.debug('[hunting-lodge effect] drawing 5 cards');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 5,
      });
    },
  },
  'kiln': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const kilnCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnHistoryIndex] ?? [];
      const kilnPlayInstance = playedThisTurn.filter((playedCardId) => playedCardId === cardEffectArgs.cardId).length;

      // Kiln starts with +$2.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      // Register a one-shot trigger for the next card played this turn.
      let nextPlayedTriggerId = '';
      nextPlayedTriggerId = cardEffectArgs.reactionManager.registerReactionTemplate(
        kilnCard,
        'cardPlayed',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async (triggeredArgs) => {
            const playedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            const copyCandidates = triggeredArgs.findCardService.findCards([
              { location: ['basicSupply', 'kingdomSupply'] },
              { cardKeys: playedCard.cardKey },
            ]);

            if (!copyCandidates.length) {
              loggerService.debug(`[kiln effect] no supply copy available for ${playedCard}`);
              return;
            }

            const copyCard = copyCandidates.slice(-1)[0];
            const promptResult = await triggeredArgs.actionService.run('userPrompt', {
              playerId: cardEffectArgs.playerId,
              prompt: `Gain a copy of ${playedCard.cardName} with Kiln?`,
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'YES', action: 2 },
              ],
              content: {
                type: 'display-cards',
                cardIds: [copyCard.id],
              },
            }) as { action?: number } | null;

            if (promptResult?.action !== 2) {
              loggerService.debug('[kiln effect] player declined to gain copy');
              return;
            }

            loggerService.debug(`[kiln effect] gaining copy ${copyCard}`);
            await triggeredArgs.actionService.run('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: copyCard.id,
              to: { location: 'playerDiscard' },
            });
          },
        },
        // Suffix is required so multiple Kiln plays can each track their own next-card trigger.
        { idSuffix: `next-play:${kilnPlayInstance}` },
      );

      // Remove unused next-card trigger at end of turn.
      cardEffectArgs.reactionManager.registerSystemTemplate(kilnCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          loggerService.debug('[kiln endTurn effect] cleaning up next-card trigger');
          triggeredArgs.reactionManager.unregisterTrigger(nextPlayedTriggerId);
        },
      }, { idSuffix: `cleanup-next-play:${kilnPlayInstance}` });
    },
  },
  'livery': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const liveryCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnHistoryIndex] ?? [];
      const liveryPlayInstance = playedThisTurn.filter((playedCardId) => playedCardId === cardEffectArgs.cardId).length;

      // Livery starts with +$3.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });

      // Register this-turn gain listener for cards costing $4 or more.
      const gainTriggerId = cardEffectArgs.reactionManager.registerReactionTemplate(
        liveryCard,
        'cardGained',
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, cardLibrary, cardPriceController }) => {
            if (trigger.args.playerId !== cardEffectArgs.playerId) {
              return false;
            }

            const gainedCard = cardLibrary.getCard(trigger.args.cardId);
            const { cost } = cardPriceController.applyRules(gainedCard, {
              playerId: cardEffectArgs.playerId,
            });

            return cost.treasure >= 4;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const horseCards = triggeredArgs.findCardService.findCards([
              { location: 'nonSupplyCards' },
              { cardKeys: 'horse' },
            ]);

            if (!horseCards.length) {
              loggerService.debug('[livery effect] no Horse cards remain to gain');
              return;
            }

            const horseCard = horseCards.slice(-1)[0];
            loggerService.debug(`[livery effect] gaining Horse ${horseCard}`);
            await triggeredArgs.actionService.run('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: horseCard.id,
              to: { location: 'playerDiscard' },
            });
          },
        },
        // Suffix is required so replay effects (e.g. Mastermind) stack multiple Livery instances.
        { idSuffix: `card-gained:${liveryPlayInstance}` },
      );

      // Remove this-turn gain listener when the turn ends.
      cardEffectArgs.reactionManager.registerSystemTemplate(liveryCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          loggerService.debug('[livery endTurn effect] cleaning up this-turn gain listener');
          triggeredArgs.reactionManager.unregisterTrigger(gainTriggerId);
        },
      }, { idSuffix: `cleanup-gain-listener:${liveryPlayInstance}` });
    },
  },
  'mastermind': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const mastermindCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnHistoryIndex] ?? [];
      const mastermindPlayInstance = playedThisTurn.filter((playedCardId) => playedCardId === cardEffectArgs.cardId)
        .length;

      // Mastermind resolves at the start of the next turn.
      cardEffectArgs.registerDurationEffect(mastermindCard, {
        id: `mastermind:${cardEffectArgs.cardId}:startTurn:${mastermindPlayInstance}`,
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          loggerService.debug('[mastermind startTurn effect] resolving delayed triple-play');

          // Return Mastermind to play area while resolving its start-turn effect.
          await triggeredArgs.actionService.run('moveCard', {
            cardId: mastermindCard.id,
            to: { location: 'playArea' },
          });

          const actionCardIdsInHand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId)
            .filter((cardId) => triggeredArgs.cardLibrary.getCard(cardId).type.includes('ACTION'));

          if (!actionCardIdsInHand.length) {
            loggerService.debug('[mastermind startTurn effect] no Action cards in hand to play');
            return;
          }

          const selectedActionId = await triggeredArgs.actionService.run('selectSingleCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'You may play an Action card from your hand three times',
            restrict: actionCardIdsInHand,
            count: 1,
            optional: true,
          }) as CardId | null;
          if (!selectedActionId) {
            loggerService.debug('[mastermind startTurn effect] player declined to play an Action');
            return;
          }

          const selectedActionCard = triggeredArgs.cardLibrary.getCard(selectedActionId);
          loggerService.debug(`[mastermind startTurn effect] playing ${selectedActionCard} three times`);

          // First play moves the selected Action from hand to play area.
          await triggeredArgs.actionService.run('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedActionId,
            overrides: {
              actionCost: 0,
            },
          });

          // Replays do not move the card again and do not spend Action plays.
          await triggeredArgs.actionService.run('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedActionId,
            overrides: {
              actionCost: 0,
              moveCard: false,
            },
          });

          await triggeredArgs.actionService.run('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedActionId,
            overrides: {
              actionCost: 0,
              moveCard: false,
            },
          });

          // Mastermind only needs duration-hold behavior when replaying a Duration card still in play.
          if (!selectedActionCard.type.includes('DURATION')) {
            return;
          }

          const isReplayedDurationInPlay = () =>
            triggeredArgs.findCardService.getCardsInPlay().some((card) => card.id === selectedActionId);

          if (!isReplayedDurationInPlay()) {
            loggerService.debug('[mastermind startTurn effect] replayed Duration not in play, no hold needed');
            return;
          }

          loggerService.debug('[mastermind startTurn effect] replayed Duration still in play, registering hold');

          // Move Mastermind back to activeDuration in cleanup while the replayed Duration remains in play.
          triggeredArgs.reactionManager.registerSystemTemplate(mastermindCard, 'startTurnPhase', {
            playerId: cardEffectArgs.playerId,
            once: true,
            compulsory: true,
            allowMultipleInstances: true,
            condition: ({ trigger, match }) => {
              if (getTurnPhase(trigger.args.phaseIndex) !== 'cleanup') {
                return false;
              }

              if (getCurrentPlayer(match).id !== cardEffectArgs.playerId) {
                return false;
              }

              return isReplayedDurationInPlay();
            },
            triggeredEffectFn: async (cleanupArgs) => {
              loggerService.debug('[mastermind duration effect] moving Mastermind to activeDuration');
              await cleanupArgs.actionService.run('moveCard', {
                cardId: mastermindCard.id,
                to: { location: 'activeDuration' },
              });
            },
          }, { idSuffix: `duration-cleanup:${mastermindPlayInstance}` });

          let durationHoldTriggerId = '';
          durationHoldTriggerId = triggeredArgs.reactionManager.registerReactionTemplate(
            mastermindCard,
            'startTurn',
            {
              playerId: cardEffectArgs.playerId,
              once: false,
              compulsory: true,
              allowMultipleInstances: true,
              condition: ({ trigger, cardSourceController }) => {
                if (trigger.args.playerId !== cardEffectArgs.playerId) {
                  return false;
                }

                return cardSourceController.getSource('activeDuration').includes(mastermindCard.id);
              },
              triggeredEffectFn: async (startTurnArgs) => {
                if (isReplayedDurationInPlay()) {
                  loggerService.debug('[mastermind duration effect] replayed Duration still in play; keeping Mastermind');
                  return;
                }

                loggerService.debug('[mastermind duration effect] replayed Duration left play; releasing Mastermind');
                await startTurnArgs.actionService.run('moveCard', {
                  cardId: mastermindCard.id,
                  to: { location: 'playArea' },
                });
                startTurnArgs.reactionManager.unregisterTrigger(durationHoldTriggerId);
              },
            },
            { idSuffix: `duration-hold:${mastermindPlayInstance}` },
          );
        },
      });
    },
  },
  'paddock': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Paddock starts with +$2.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      // Gain 2 Horses from the Horse pile.
      for (let index = 0; index < 2; index++) {
        const horseCards = cardEffectArgs.findCardService.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'horse' },
        ]);

        if (!horseCards.length) {
          loggerService.debug('[paddock effect] no Horse cards remain to gain');
          break;
        }

        const horseCard = horseCards.slice(-1)[0];
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: horseCard.id,
          to: { location: 'playerDiscard' },
        });
      }

      // Empty pile count is evaluated at this point in resolution.
      const emptySupplyPiles = getStartingSupplyCount(cardEffectArgs.match) -
        cardEffectArgs.findCardService.getRemainingSupplyCount();

      if (emptySupplyPiles < 1) {
        loggerService.debug('[paddock effect] no empty supply piles, gaining 0 Actions');
        return;
      }

      loggerService.debug(`[paddock effect] gaining ${emptySupplyPiles} Action(s) from empty supply piles`);
      await cardEffectArgs.actionService.run('gainAction', {
        count: emptySupplyPiles,
      });
    },
  },
  'sanctuary': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Sanctuary is a cantrip +Buy with an optional exile from hand.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[sanctuary effect] no cards in hand to exile');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'You may Exile a card from your hand',
        restrict: hand,
        count: 1,
        optional: true,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.debug('[sanctuary effect] player declined to exile a card');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      loggerService.debug(`[sanctuary effect] exiling ${selectedCard}`);
      await cardEffectArgs.actionService.run('exileCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });
    },
  },
  'scrap': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[scrap effect] no cards in hand to trash');
        return;
      }

      // Scrap starts by trashing exactly one card from hand.
      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: hand,
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.warn('[scrap effect] no card selected to trash');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const { cost: selectedCardCost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId,
      });

      loggerService.debug(`[scrap effect] trashing ${selectedCard}`);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      const bonusCount = Math.max(0, Math.min(6, selectedCardCost.treasure ?? 0));
      if (bonusCount < 1) {
        loggerService.debug('[scrap effect] trashed card cost is 0, no bonus choices');
        return;
      }

      const bonusOptions = [
        { id: 'draw', label: '+1 Card' },
        { id: 'action', label: '+1 Action' },
        { id: 'buy', label: '+1 Buy' },
        { id: 'treasure', label: '+$1' },
        { id: 'silver', label: 'Gain a Silver' },
        { id: 'horse', label: 'Gain a Horse' },
      ] as const;

      // Resolve each selected bonus immediately before asking for the next one.
      const resolveBonus = async (bonusId: (typeof bonusOptions)[number]['id']) => {
        if (bonusId === 'draw') {
          await cardEffectArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
          return;
        }

        if (bonusId === 'action') {
          await cardEffectArgs.actionService.run('gainAction', { count: 1 });
          return;
        }

        if (bonusId === 'buy') {
          await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
          return;
        }

        if (bonusId === 'treasure') {
          await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
          return;
        }

        if (bonusId === 'silver') {
          const gainedSilverId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: cardEffectArgs.playerId,
            pileKey: 'silver',
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'scrap effect',
          });
          if (!gainedSilverId) {
            loggerService.debug('[scrap effect] no Silver cards remain to gain');
            return;
          }
          return;
        }

        const horseCards = cardEffectArgs.findCardService.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'horse' },
        ]);

        if (!horseCards.length) {
          loggerService.debug('[scrap effect] no Horse cards remain to gain');
          return;
        }

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: horseCards.slice(-1)[0].id,
          to: { location: 'playerDiscard' },
        });
      };

      const selectedBonusIds = new Set<string>();
      while (selectedBonusIds.size < bonusCount) {
        const remainingOptions = bonusOptions.filter((option) => !selectedBonusIds.has(option.id));
        const selectedOption = bonusCount >= bonusOptions.length
          ? remainingOptions[0]
          : remainingOptions[Math.max(0, ((await cardEffectArgs.actionService.run('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: `Choose bonus ${selectedBonusIds.size + 1} of ${bonusCount} (Scrap)`,
            actionButtons: remainingOptions.map((option, index) => ({
              label: option.label,
              action: index + 1,
            })),
          }) as { action?: number } | null)?.action ?? 1) - 1)] ?? remainingOptions[0];

        selectedBonusIds.add(selectedOption.id);
        await resolveBonus(selectedOption.id);
      }
    },
  },
  'sheepdog': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ loggerService,  reactionManager, cardLibrary }, { playerId, cardId }) => {
        const sheepdogCard = cardLibrary.getCard(cardId);

        reactionManager.registerReactionTemplate(sheepdogCard, 'cardGained', {
          playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: ({ cardSourceController }) => {
            // Sheepdog must still be in hand to be reactable.
            try {
              const source = cardSourceController.findCardSource(cardId);
              return source.sourceKey === 'playerHand' && source.playerId === playerId;
            } catch {
              return false;
            }
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const promptResult = await triggeredArgs.actionService.run('userPrompt', {
              playerId,
              prompt: 'Play Sheepdog?',
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'YES', action: 2 },
              ],
            }) as { action?: number } | null;

            if (promptResult?.action !== 2) {
              loggerService.debug('[sheepdog reaction] player declined to play Sheepdog');
              return;
            }

            // Re-check source in case a prior reaction moved this card.
            try {
              const source = triggeredArgs.cardSourceController.findCardSource(cardId);
              if (source.sourceKey !== 'playerHand' || source.playerId !== playerId) {
                loggerService.debug('[sheepdog reaction] Sheepdog not in hand anymore, skipping play');
                return;
              }
            } catch {
              loggerService.debug('[sheepdog reaction] Sheepdog source not found, skipping play');
              return;
            }

            await triggeredArgs.actionService.run('playCard', {
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
        const sheepdogCard = cardLibrary.getCard(cardId);
        reactionManager.unregisterTrigger(`${sheepdogCard.cardName}:${cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
            // Sheepdog is a terminal +2 Cards.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
    },
  },
  'sleigh': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ loggerService,  reactionManager, cardLibrary }, { playerId, cardId }) => {
        const sleighCard = cardLibrary.getCard(cardId);

        reactionManager.registerReactionTemplate(sleighCard, 'cardGained', {
          playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: ({ trigger, cardSourceController }) => {
            // Sleigh only reacts to gains by its owner and only while this copy remains in hand.
            if (trigger.args.playerId !== playerId) {
              return false;
            }
            try {
              const source = cardSourceController.findCardSource(cardId);
              return source.sourceKey === 'playerHand' && source.playerId === playerId;
            } catch {
              return false;
            }
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            const promptResult = await triggeredArgs.actionService.run('userPrompt', {
              playerId,
              prompt: `Discard Sleigh to move ${gainedCard.cardName}?`,
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'TO HAND', action: 2 },
                { label: 'TO DECK', action: 3 },
              ],
              content: {
                type: 'display-cards',
                cardIds: [gainedCard.id],
              },
            }) as { action?: number } | null;

            if (promptResult?.action !== 2 && promptResult?.action !== 3) {
              loggerService.debug('[sleigh reaction] player declined to discard Sleigh');
              return;
            }

            loggerService.debug('[sleigh reaction] discarding Sleigh as reaction cost');
            await triggeredArgs.actionService.run('discardCard', {
              playerId,
              cardId,
            });

            const gainedLocation = triggeredArgs.trigger.args.gainedLocation;
            if (!gainedLocation) {
              loggerService.debug('[sleigh reaction] gained location is unknown; cannot move gained card');
              return;
            }

            // Stop-moving/lose-track guard: only move if the gained card is still where it was gained to.
            try {
              const currentSource = triggeredArgs.cardSourceController.findCardSource(gainedCard.id);
              if (
                currentSource.sourceKey !== gainedLocation.location ||
                currentSource.playerId !== gainedLocation.playerId
              ) {
                loggerService.debug('[sleigh reaction] gained card moved since gain, skipping move');
                return;
              }
            } catch {
              loggerService.debug('[sleigh reaction] gained card source no longer exists, skipping move');
              return;
            }

            const destination = promptResult.action === 2 ? 'playerHand' : 'playerDeck';
            loggerService.debug(`[sleigh reaction] moving gained card ${gainedCard} to ${destination}`);
            await triggeredArgs.actionService.run('moveCard', {
              cardId: gainedCard.id,
              toPlayerId: playerId,
              to: { location: destination },
            });
          },
        });
      },
      onLeaveHand: async ({ reactionManager, cardLibrary }, { cardId }) => {
        const sleighCard = cardLibrary.getCard(cardId);
        reactionManager.unregisterTrigger(`${sleighCard.cardName}:${cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            // Sleigh gains 2 Horses from the Horse pile.
      for (let index = 0; index < 2; index++) {
        const horseCards = cardEffectArgs.findCardService.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'horse' },
        ]);

        if (!horseCards.length) {
          loggerService.debug('[sleigh effect] no Horse cards remain to gain');
          return;
        }

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: horseCards.slice(-1)[0].id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'snowy-village': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const snowyVillageCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnHistoryIndex] ?? [];
      const snowyVillagePlayInstance = playedThisTurn
        .filter((playedCardId) => playedCardId === cardEffectArgs.cardId)
        .length;

      // Snowy Village grants its printed bonuses before locking further +Actions.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 4 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const actionLockTriggerId = cardEffectArgs.reactionManager.registerReactionTemplate(
        snowyVillageCard,
        'actionGain',
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, match }) =>
            trigger.args.playerId === cardEffectArgs.playerId &&
            getCurrentPlayer(match).id === cardEffectArgs.playerId,
          triggeredEffectFn: async (triggeredArgs) => {
            if (triggeredArgs.trigger.args.count <= 0) {
              return;
            }
            loggerService.debug(
              `[snowy-village action lock] ignoring +${triggeredArgs.trigger.args.count} Action(s) for player ${cardEffectArgs.playerId}`,
            );
            triggeredArgs.trigger.args.count = 0;
          },
        },
        { idSuffix: `lock-actions:${snowyVillagePlayInstance}` },
      );

      // Cleanup the lock at end turn; it only applies for the current turn.
      cardEffectArgs.reactionManager.registerSystemTemplate(snowyVillageCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          loggerService.debug('[snowy-village effect] removing action-gain lock at end turn');
          triggeredArgs.reactionManager.unregisterTrigger(actionLockTriggerId);
        },
      }, { idSuffix: `cleanup-action-lock:${snowyVillagePlayInstance}` });
    },
  },
  'stockpile': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      // Stockpile exiles itself if it is still a card in play when this resolves.
      try {
        const source = cardEffectArgs.cardSourceController.findCardSource(cardEffectArgs.cardId);
        if (source.sourceKey !== 'playArea' && source.sourceKey !== 'activeDuration') {
          loggerService.debug('[stockpile effect] Stockpile is no longer in play, skipping exile');
          return;
        }
      } catch {
        loggerService.debug('[stockpile effect] Stockpile source not found, skipping exile');
        return;
      }

      await cardEffectArgs.actionService.run('exileCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
      });
    },
  },
  'supplies': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const horseCards = cardEffectArgs.findCardService.findCards([
        { location: 'nonSupplyCards' },
        { cardKeys: 'horse' },
      ]);

      if (!horseCards.length) {
        loggerService.debug('[supplies effect] no Horse cards remain to gain');
        return;
      }

      // Supplies gains a Horse directly onto your deck.
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: horseCards.slice(-1)[0].id,
        to: { location: 'playerDeck' },
      });
    },
  },
  'village-green': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
      const loggerService = args.loggerService;
        if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
          loggerService.debug('[village-green onDiscarded] discarded during cleanup, skipping reaction');
          return;
        }

        const promptResult = await args.actionService.run('userPrompt', {
          playerId: eventArgs.playerId,
          prompt: 'Play Village Green?',
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'YES', action: 2 },
          ],
        }) as { action?: number } | null;

        if (promptResult?.action !== 2) {
          loggerService.debug('[village-green onDiscarded] player declined to play Village Green');
          return;
        }

        loggerService.debug('[village-green onDiscarded] playing Village Green from discard');
        await args.actionService.run('playCard', {
          playerId: eventArgs.playerId,
          cardId: eventArgs.cardId,
          overrides: {
            actionCost: 0,
          },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            const villageGreenCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const playedThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnHistoryIndex] ?? [];
      const villageGreenPlayInstance = playedThisTurn
        .filter((playedCardId) => playedCardId === cardEffectArgs.cardId)
        .length;

      const promptResult = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Use Village Green now or at the start of your next turn?',
        actionButtons: [
          { label: 'NOW', action: 1 },
          { label: 'NEXT TURN', action: 2 },
        ],
      }) as { action?: number } | null;

      if (promptResult?.action !== 2) {
        loggerService.debug('[village-green effect] resolving immediate mode');
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 1,
        });

        // Off-turn immediate plays still draw, but +Actions only matter on your own turn.
        if (getCurrentPlayer(cardEffectArgs.match).id === cardEffectArgs.playerId) {
          await cardEffectArgs.actionService.run('gainAction', { count: 2 });
        } else {
          loggerService.debug('[village-green effect] off-turn immediate play, skipping +Actions');
        }
        return;
      }

      loggerService.debug('[village-green effect] registering delayed mode');
      cardEffectArgs.registerDurationEffect(villageGreenCard, {
        id: `village-green:${cardEffectArgs.cardId}:startTurn:${villageGreenPlayInstance}`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: villageGreenCard.id,
            to: { location: 'playArea' },
          });

          await triggeredArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
          await triggeredArgs.actionService.run('gainAction', { count: 2 });
        },
      });
    },
  },
  'wayfarer': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
            await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 3,
      });

      const topSilverCard = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({
        pileKey: 'silver',
        from: 'basicSupply',
      });
      if (!topSilverCard) {
        loggerService.debug('[wayfarer effect] no Silver cards remain to gain');
        return;
      }

      const promptResult = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a Silver?',
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'YES', action: 2 },
        ],
        content: {
          type: 'display-cards',
          cardIds: [topSilverCard.id],
        },
      }) as { action?: number } | null;

      if (promptResult?.action !== 2) {
        loggerService.debug('[wayfarer effect] player declined to gain Silver');
        return;
      }

      await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'silver',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'wayfarer effect',
      });
    },
  },
  'horse': {
    registerEffects: () => async (cardEffectArgs) => {
            // Horse draws 2 cards and then returns itself to the Horse pile.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: cardEffectArgs.cardId,
        to: { location: 'nonSupplyCards' },
      });
    },
  },
};

export default expansion;
