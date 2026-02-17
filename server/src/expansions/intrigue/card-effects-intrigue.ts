import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { ActionButtons, Card, CardId, CardKey, PlayerId } from 'shared/types/index.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';

const expansionModule: CardExpansionModule = {
  'baron': {
    registerEffects: () => async ({ actionService, cardLibrary, match, playerId, ...args }) => {
      // +1 Buy
      // You may discard an Estate for +$4. If you don't, gain an Estate.

      console.debug(`[BARON EFFECT] gaining 1 buy...`);

      await actionService.run('gainBuy', {
        count: 1,
      });

      const hand = args.cardSourceController.getSource('playerHand', playerId);

      const handEstateIdx = hand.findLast((cId) => cardLibrary.getCard(cId).cardKey === 'estate');

      const supplyEstateIdx = args.findCardService.findCards([{ location: 'basicSupply' }, { cardKeys: 'estate' }])
        ?.slice(-1)?.[0].id;

      if (!handEstateIdx) {
        console.debug(`[BARON EFFECT] player has no estates in hand, they gain one`);

        if (!supplyEstateIdx) {
          console.debug(`[BARON EFFECT] no estates in supply`);
          return;
        }
      } else {
        console.debug(`[BARON EFFECT] player has an estate in hand`);

        const confirm = await actionService.run('userPrompt', {
          playerId,
          prompt: 'Discard estate?',
          actionButtons: [
            { label: `DON'T DISCARD`, action: 1 },
            { label: 'DISCARD', action: 2 },
          ],
        }) as { action: number };

        if (confirm.action === 2) {
          console.debug(`[BARON EFFECT] player chooses to discard estate, gain 4 treasure`);

          await actionService.run('discardCard', {
            cardId: handEstateIdx,
            playerId,
          });

          await actionService.run('gainTreasure', {
            count: 4,
          });

          return;
        }
      }

      if (!supplyEstateIdx) {
        console.debug(`[BARON EFFECT] no estate in supply`);
        return;
      }

      console.debug(`[BARON EFFECT] player not discarding estate, gain ${cardLibrary.getCard(supplyEstateIdx)}...`);

      await actionService.run('gainCard', {
        playerId,
        cardId: supplyEstateIdx,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'bridge': {
    registerEffects: () =>
    async ({
      reactionManager,
      cardLibrary,
      actionService,
      cardPriceController,
      cardId,
      playerId,
    }) => {
      console.debug(`[BRIDGE EFFECT] gaining 1 buy...`);

      await actionService.run('gainBuy', { count: 1 });

      console.debug(`[BRIDGE EFFECT] gaining 1 treasure...`);

      await actionService.run('gainTreasure', {
        count: 1,
      });

      console.debug(`[BRIDGE EFFECT] modify cost by -1 of all cards...`);

      const allCards = cardLibrary.getAllCardsAsArray();
      const ruleCleanups: (() => void)[] = [];
      for (const card of allCards) {
        ruleCleanups.push(
          cardPriceController.registerRule(
            card,
            (card, context) => {
              return { restricted: false, cost: { treasure: -1 } };
            },
          ),
        );
      }

      reactionManager.registerReactionTemplate({
        id: `bridge:${cardId}:endTurn`,
        listeningFor: 'endTurn',
        condition: () => true,
        triggeredEffectFn: async () => {
          for (const rule of ruleCleanups) {
            rule();
          }
          reactionManager.unregisterTrigger(`bridge:${cardId}:endTurn`);
        },
        playerId,
        compulsory: true,
      });
    },
  },
  'conspirator': {
    registerEffects: () => async ({ match, cardLibrary, playerId, actionService }) => {
      console.debug(`[CONSPIRATOR EFFECT] gaining 2 treasure...`);

      await actionService.run('gainTreasure', { count: 2 });

      // we want those cards played on the player's turn that are actions and played by THAT player
      const actionCardCount = Object.keys(match.stats.playedCards)
        .filter((cardId) =>
          cardLibrary.getCard(+cardId).type.includes('ACTION') &&
          match.stats.playedCards[+cardId].playerId === playerId
        );

      console.debug(`[CONSPIRATOR EFFECT] action cards played so far ${actionCardCount.length}`);

      if (actionCardCount?.length >= 3) {
        console.debug(`[CONSPIRATOR EFFECT] drawing card...`);

        await actionService.run('drawCard', { playerId });

        console.debug(`[CONSPIRATOR EFFECT] gaining 1 action...`);

        await actionService.run('gainAction', {
          count: 1,
        });
      }
    },
  },
  'courtier': {
    registerEffects: () => async ({ match, playerId, cardLibrary, actionService, ...args }) => {
      const hand = args.cardSourceController.getSource('playerHand', playerId);

      if (!hand.length) {
        console.debug(`[COURTIER EFFECT] no cards in hand`);
        return;
      }

      console.debug(`[COURTIER EFFECT] prompting user to reveal a card...`);

      const cardId = await actionService.run('selectSingleCard', {
        prompt: 'Reveal card',
        count: 1,
        playerId,
        restrict: hand,
      }) as number | null;
      if (!cardId) {
        console.debug('[COURTIER EFFECT] no card selected to reveal');
        return;
      }

      console.debug(`[COURTIER EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);

      await actionService.run('revealCard', {
        cardId,
        playerId,
      });

      let cardTypeCount = cardLibrary.getCard(cardId).type.length;

      console.debug(`[COURTIER EFFECT] card has ${cardTypeCount} types`);

      cardTypeCount = Math.min(cardTypeCount, 4);

      console.debug(`[COURTIER EFFECT] final choice count ${cardTypeCount}`);

      const choices = [
        { label: '+1 Action', action: 1 },
        { label: '+1 Buy', action: 2 },
        { label: '+3 Treasure', action: 3 },
        { label: 'Gain a gold', action: 4 },
      ];

      for (let i = 0; i < cardTypeCount; i++) {
        console.debug(`[COURTIER EFFECT] prompting user to select an action...`);

        const result = await actionService.run('userPrompt', {
          playerId,
          prompt: 'Choose one',
          actionButtons: choices,
        }) as { action: number };

        const resultAction = result.action;

        console.debug(`[COURTIER EFFECT] player chose '${choices.find((c) => c.action === resultAction)?.label}'`);

        const idx = choices.findIndex((c) => c.action === resultAction);
        choices.splice(idx, 1);

        switch (resultAction) {
          case 1:
            console.debug(`[COURTIER EFFECT] gaining 1 action...`);
            await actionService.run('gainAction', {
              count: 1,
            });
            break;
          case 2:
            console.debug(`[COURTIER EFFECT] gaining 1 buy...`);
            await actionService.run('gainBuy', {
              count: 1,
            });
            break;
          case 3:
            console.debug(`[COURTIER EFFECT] gaining 1 treasure...`);
            await actionService.run('gainTreasure', {
              count: 3,
            });
            break;
          case 4: {
            const goldCardId = args.findCardService.findCards([{ location: 'basicSupply' }, { cardKeys: 'gold' }])
              ?.slice(-1)?.[0].id;

            if (!goldCardId) {
              console.debug(`[COURTIER EFFECT] no gold in supply...`);
              break;
            }

            console.debug(`[COURTIER EFFECT] gaining ${cardLibrary.getCard(goldCardId)}...`);
            await actionService.run('gainCard', {
              cardId: goldCardId,
              playerId,
              to: {
                location: 'playerDiscard',
              },
            });
            break;
          }
        }
      }
    },
  },
  'courtyard': {
    registerEffects: () => async ({ match, actionService, playerId, cardLibrary, ...args }) => {
      console.debug(`[COURTYARD EFFECT] drawing 3 cards...`);

      await actionService.run('drawCard', { playerId, count: 3 });

      const hand = args.cardSourceController.getSource('playerHand', playerId);

      if (!hand.length) {
        console.debug(`[COURTYARD EFFECT] no cards in hand`);
        return;
      }

      console.debug(`[COURTYARD EFFECT] prompting user to put card onto deck...`);

      const cardId = await actionService.run('selectSingleCard', {
        prompt: 'Top deck',
        count: 1,
        playerId,
        restrict: args.cardSourceController.getSource('playerHand', playerId),
      }) as number | null;
      if (!cardId) {
        console.debug('[COURTYARD EFFECT] no card selected to top-deck');
        return;
      }

      console.debug(`[COURTYARD EFFECT] moving ${cardLibrary.getCard(cardId)} to top of deck...`);

      await actionService.run('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: { location: 'playerDeck' },
      });
    },
  },
  'diplomat': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ reactionManager, actionService, ...args }, { playerId, cardId }) => {
        reactionManager.registerReactionTemplate({
          id: `diplomat:${cardId}:cardPlayed`,
          playerId,
          listeningFor: 'cardPlayed',
          condition: ({ match, trigger, cardLibrary, ...args }) => {
            return cardLibrary.getCard(trigger.args.cardId!).type.includes('ATTACK') &&
              args.cardSourceController.getSource('playerHand', playerId).length >= 5 &&
              trigger.args.playerId !== playerId;
          },
          triggeredEffectFn: async function ({ reaction, cardLibrary }) {
            const sourceId = reaction.getSourceId();

            console.debug(`[diplomat triggered effect] running for ${cardLibrary.getCard(cardId)}`);

            await actionService.run('revealCard', {
              cardId: sourceId,
              playerId: reaction.playerId,
            });

            await actionService.run('drawCard', { playerId });
            await actionService.run('drawCard', { playerId });
            const cardIds = await actionService.run('selectCard', {
              prompt: 'Confirm discard',
              playerId,
              restrict: args.cardSourceController.getSource('playerHand', playerId),
              count: 3,
            });

            for (const cardId of cardIds) {
              await actionService.run('discardCard', {
                playerId,
                cardId,
              });
            }
          },
        });
      },
      onLeaveHand: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`diplomat:${cardId}:cardPlayed`);
      },
    }),
    registerEffects: () => async ({ match, actionService, playerId, ...args }) => {
      console.debug(`[DIPLOMAT EFFECT] drawing 2 cards...`);

      await actionService.run('drawCard', { playerId, count: 2 });

      const cardCount = args.cardSourceController.getSource('playerHand', playerId).length;

      if (cardCount <= 5) {
        console.debug(`[DIPLOMAT EFFECT] gaining 2 actions...`);

        await actionService.run('gainAction', { count: 2 });
      } else {
        console.debug(`[DIPLOMAT EFFECT] player has more than ${cardCount} cards in hand, can't perform diplomat`);
      }
    },
  },
  'duke': {
    registerScoringFunction: () => ({ match, cardLibrary, ownerId, ...args }) => {
      const duchies = args.findCardService.findCards([{ owner: ownerId }, { cardKeys: 'duchy' }]);

      console.debug(`[DUKE SCORING] player ${getPlayerById(match, ownerId)} has ${duchies.length} Duchies`);

      return duchies.length;
    },
    registerEffects: () => async () => {
      console.debug(`[DUKE EFFECT] duke has no effects`);
    },
  },
  'farm': {
    registerEffects: () => async ({ actionService }) => {
      console.debug(`[FARM EFFECT] gaining 2 treasure...`);

      await actionService.run('gainTreasure', {
        count: 2,
      });
    },
  },
  'ironworks': {
    registerEffects: () => async ({ cardLibrary, actionService, playerId, ...args }) => {
      console.debug(`[IRONWORKS EFFECT] prompting user to choose card costing up to 4...`);

      const cardId = await actionService.run('selectSingleCard', {
        prompt: 'Choose card',
        count: 1,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId, amount: { treasure: 4 }, kind: 'upTo' },
        ],
        playerId,
      }) as number | null;
      if (!cardId) {
        console.debug('[IRONWORKS EFFECT] no card selected to gain');
        return;
      }

      console.debug(`[IRONWORKS EFFECT] gaining ${cardLibrary.getCard(cardId)}...`);

      await actionService.run('gainCard', {
        cardId,
        playerId,
        to: { location: 'playerDiscard' },
      });

      const card = cardLibrary.getCard(cardId);

      if (card.type.includes('ACTION')) {
        console.debug(`[IRONWORKS EFFECT] card is an action, gaining 1 action...`);

        await actionService.run('gainAction', {
          count: 1,
        });
      }

      if (card.type.includes('TREASURE')) {
        console.debug(`[IRONWORKS EFFECT] card is a treasure, gaining 1 treasure...`);

        await actionService.run('gainTreasure', {
          count: 1,
        });
      }

      if (card.type.includes('VICTORY')) {
        console.debug(`[IRONWORKS EFFECT] card is a victory, drawing card...`);

        await actionService.run('drawCard', { playerId });
      }
    },
  },
  'lurker': {
    registerEffects: () => async ({ cardLibrary, match, playerId, actionService, ...args }) => {
      console.debug(`[LURKER EFFECT] gaining 1 action...`);

      await actionService.run('gainAction', { count: 1 });

      let result = { action: 1 };

      const actionButtons: ActionButtons = [
        { action: 1, label: 'TRASH CARD' },
        { action: 2, label: 'GAIN CARD' },
      ];

      result = await actionService.run('userPrompt', {
        playerId,
        prompt: 'Trash Action card from supply, or gain Action card from trash?',
        actionButtons,
      }) as { action: number };

      console.debug(
        `[LURKER EFFECT] user choose action ${actionButtons.find((a) => a.action === result.action)?.label}`,
      );

      if (result.action === 1) {
        console.debug(`[LURKER EFFECT] prompting user to select card to trash...`);

        const cardId = await actionService.run('selectSingleCard', {
          prompt: 'Confirm trash',
          playerId,
          count: 1,
          restrict: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { cardType: 'ACTION' },
          ],
        }) as number | null;
        if (!cardId) {
          console.debug('[LURKER EFFECT] no action card selected to trash');
          return;
        }

        console.debug(`[LURKER EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('trashCard', {
          cardId,
          playerId,
        });

        return;
      }

      const trash = args.findCardService.findCards({ location: 'trash' });
      const actionCardIds = trash.filter((cardId) => cardId.type.includes('ACTION'));

      if (!actionCardIds.length) {
        console.debug(`[LURKER EFFECT] trash has no action cards`);
        return;
      }

      if (!trash.some((cId) => cId.type.includes('ACTION'))) {
        console.debug(`[LURKER EFFECT] no action cards in trash, skipping gaining`);
        return;
      }

      let cardId: CardId;
      if (args.findCardService.findCards({ location: 'trash' }).length === 1) {
        console.debug(`[LURKER EFFECT] only one card in trash, gaining automatically`);
        cardId = trash[0].id;
      } else {
        console.debug(`[LURKER EFFECT] prompting user to select action card to gain...`);

        const selectedCardId = await args.promptService.selectSingleCardFromPrompt({
          prompt: 'Choose card to gain',
          playerId,
          content: {
            type: 'select',
            selectCount: 1,
            cardIds: actionCardIds.map((card) => card.id),
          },
        });

        if (!selectedCardId) {
          return;
        }
        cardId = selectedCardId;
      }

      console.debug(`[LURKER EFFECT] gaining ${cardLibrary.getCard(cardId)}...`);

      await actionService.run('gainCard', {
        cardId,
        playerId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'masquerade': {
    registerEffects: () => async ({ actionService, playerId, match, cardLibrary, ...args }) => {
      console.debug(`[masquerade effect] drawing 2 cards...`);

      await actionService.run('drawCard', { playerId, count: 2 });

      const targets = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL',
        match,
      }).filter((playerId) => args.cardSourceController.getSource('playerHand', playerId).length > 0);

      console.debug(`[masquerade effect] targets in order ${targets.map((t) => getPlayerById(match, t)).join(',')}`);

      const playerCardMap = new Map<PlayerId, CardId>();

      for (const playerId of targets) {
        console.debug(`[masquerade effect] prompting ${getPlayerById(match, playerId)} to choose a card...`);

        const selectedCardId = await actionService.run('selectSingleCard', {
          prompt: 'Confirm pass',
          playerId,
          count: 1,
          restrict: args.cardSourceController.getSource('playerHand', playerId),
        });

        if (!selectedCardId) {
          continue;
        }

        playerCardMap.set(playerId, selectedCardId);

        console.debug(
          `[masquerade effect] ${getPlayerById(match, playerId)} chose ${cardLibrary.getCard(selectedCardId)}`,
        );
      }

      for (let i = 0; i < targets.length; i++) {
        const cardId = playerCardMap.get(targets[i]);

        if (!cardId) {
          console.warn(`[masquerade effect] no card for ${getPlayerById(match, targets[i])}`);
          continue;
        }

        const playerId = targets[(i + 1) % targets.length];

        const card = cardLibrary.getCard(cardId);
        card.owner = playerId;

        console.debug(
          `[masquerade effect] moving ${cardLibrary.getCard(cardId!)} to ${getPlayerById(match, playerId!)}`,
        );

        await actionService.run('moveCard', {
          cardId: cardId!,
          toPlayerId: playerId!,
          to: { location: 'playerHand' },
        });
      }

      console.debug(`[masquerade effect] prompting user to trash card from hand...`);

      const selectedCardId = await actionService.run('selectSingleCard', {
        optional: true,
        prompt: 'Confirm trash',
        count: 1,
        playerId,
        restrict: args.cardSourceController.getSource('playerHand', playerId),
      });

      console.debug(
        `[masquerade effect] player chose ${selectedCardId ? cardLibrary.getCard(selectedCardId) : 'not to trash'}`,
      );

      if (selectedCardId) {
        console.debug(`[masquerade effect] trashing ${cardLibrary.getCard(selectedCardId)}...`);

        await actionService.run('trashCard', {
          cardId: selectedCardId,
          playerId,
        });
      }
    },
  },
  'mill': {
    registerEffects: () => async ({ actionService, playerId, match, cardLibrary, ...args }) => {
      console.debug(`[MILL EFFECT] drawing card...`);

      await actionService.run('drawCard', { playerId });

      console.debug(`[MILL EFFECT] gaining 1 action...`);

      await actionService.run('gainAction', { count: 1 });

      const hand = args.cardSourceController.getSource('playerHand', playerId);

      if (hand.length === 0) {
        console.debug(`[MILL EFFECT] player has no cards in hand`);
        return;
      }

      console.debug(`[MILL EFFECT] prompting user to select cards to discard`);

      const results = await actionService.run('selectCard', {
        optional: true,
        prompt: 'Confirm discard',
        playerId,
        restrict: hand,
        count: Math.min(2, hand.length),
      });

      for (const cardId of results) {
        console.debug(`[MILL EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('discardCard', {
          cardId,
          playerId,
        });
      }

      console.debug(`[MILL EFFECT] gaining 2 treasure...`);

      if (results.length == 2) {
        await actionService.run('gainTreasure', {
          count: 2,
        });
      }
    },
  },
  'mining-village': {
    registerEffects: () => async ({ actionService, playerId, cardId, cardLibrary }) => {
      console.debug(`[MINING VILLAGE EFFECT] drawing card...`);

      await actionService.run('drawCard', { playerId });

      console.debug(`[MINING VILLAGE EFFECT] gaining 2 actions`);

      await actionService.run('gainAction', { count: 2 });

      console.debug(`[MINING VILLAGE EFFECT] prompting user to trash mining village or not`);
      const results = await actionService.run('userPrompt', {
        playerId,
        actionButtons: [
          { action: 1, label: `DON'T TRASH` },
          { action: 2, label: 'TRASH' },
        ],
        prompt: 'Trash Mining Village?',
      }) as { action: number };

      if (results.action === 2) {
        console.debug(`[MINING VILLAGE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('trashCard', {
          playerId,
          cardId,
        });

        console.debug(`[MINING VILLAGE EFFECT] gaining 2 treasure...`);

        await actionService.run('gainTreasure', {
          count: 2,
        });
      } else {
        console.debug(`[MINING VILLAGE EFFECT] player chose not to trash mining village`);
      }
    },
  },
  'minion': {
    registerEffects:
      () => async ({ match, reactionContext, cardLibrary, actionService, playerId, ...args }) => {
        console.debug(`[MINION EFFECT] gaining 1 action...`);

        await actionService.run('gainAction', { count: 1 });

        console.debug(`[MINION EFFECT] prompting user to gain treasure or discard hand...`);

        const results = await actionService.run('userPrompt', {
          playerId,
          actionButtons: [
            { action: 1, label: '+2 Treasure' },
            { action: 2, label: 'Discard hand' },
          ],
        }) as { action: number };

        if (results.action === 1) {
          console.debug(`[MINION EFFECT] gaining 2 treasure...`);

          await actionService.run('gainTreasure', {
            count: 2,
          });
        } else {
          const targets = findOrderedTargets({
            startingPlayerId: playerId,
            appliesTo: 'ALL',
            match,
          }).filter((playerId) => {
            const hand = args.cardSourceController.getSource('playerHand', playerId);
            const handCount = hand.length;
            return playerId === playerId ||
              (handCount >= 5 && !isPlayerImmune(reactionContext, playerId));
          });

          for (const playerId of targets) {
            const player = getPlayerById(match, playerId);
            const hand = args.cardSourceController.getSource('playerHand', playerId);
            const l = hand.length;
            for (let i = l - 1; i >= 0; i--) {
              const cardId = hand[i];

              console.debug(`[MINION EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);

              await actionService.run('discardCard', {
                cardId,
                playerId,
              });
            }

            console.debug(`[MINION EFFECT] ${player} drawing 4 cards...`);

            await actionService.run('drawCard', { playerId, count: 4 });
          }
        }
      },
  },
  'nobles': {
    registerEffects: () => async ({ actionService, playerId }) => {
      console.debug(`[NOBLES EFFECT] prompting user to select actions or treasure`);

      const result = await actionService.run('userPrompt', {
        playerId,
        actionButtons: [
          { action: 1, label: '+3 Cards' },
          { action: 2, label: '+2 Actions' },
        ],
        prompt: 'Choose one',
      }) as { action: number };

      console.debug(`[NOBLES EFFECT] player chose ${result.action}`);

      if (result.action === 1) {
        console.debug(`[NOBLES EFFECT] drawing 3 cards...`);

        await actionService.run('drawCard', { playerId, count: 3 });
      } else {
        console.debug(`[NOBLES EFFECT] gaining 2 actions`);
        await actionService.run('gainAction', {
          count: 2,
        });
      }
    },
  },
  'patrol': {
    registerEffects: () => async ({ actionService, match, playerId, cardLibrary, ...args }) => {
      console.debug(`[PATROL EFFECT] drawing 3 cards`);

      await actionService.run('drawCard', { playerId, count: 3 });

      const deck = args.cardSourceController.getSource('playerDeck', playerId);
      const discard = args.cardSourceController.getSource('playerDiscard', playerId);

      console.debug(`[PATROL EFFECT] original num to reveal 4`);

      const numToReveal = Math.min(4, deck.length + discard.length);

      console.debug(`[PATROL EFFECT] final num to reveal ${numToReveal}`);

      if (numToReveal === 0) {
        console.debug(`[PATROL EFFECT] no cards to reveal`);
        return;
      }

      if (deck.length < numToReveal) {
        console.debug(`[PATROL EFFECT] not enough cards in deck, shuffling`);
        await actionService.run('shuffleDeck', {
          playerId,
        });
      }

      const revealedCardIds: Card[] = args.findCardService.findCards({ location: 'playerDeck', playerId }).slice(-numToReveal);

      for (const cardId of revealedCardIds) {
        console.debug(`[PATROL EFFECT] revealing ${cardId}...`);

        await actionService.run('revealCard', {
          cardId,
          playerId,
          moveToSetAside: true,
        });
      }

      const [victoryCards, nonVictoryCards] = revealedCardIds
        .reduce((prev, card) => {
          if (card.type.includes('VICTORY') || card.cardKey === 'curse') {
            prev[0].push(card);
          } else {
            prev[1].push(card);
          }
          return prev;
        }, [[], []] as Card[][]);

      for (const card of victoryCards) {
        console.debug(`[PATROL EFFECT] moving ${card} to hand...`);

        await actionService.run('moveCard', {
          cardId: card.id,
          toPlayerId: playerId,
          to: { location: 'playerHand' },
        });
      }

      if (nonVictoryCards.length < 2) {
        if (nonVictoryCards.length === 1) {
          console.debug(`[PATROL EFFECT] non-victory card count is ${nonVictoryCards.length}, no need to rearrange`);
          await actionService.run('moveCard', {
            cardId: nonVictoryCards[0].id,
            to: { location: 'playerDeck' },
          });
        }

        return;
      }

      console.debug(`[PATROL EFFECT] prompting user to rearrange cards...`);

      const result = await actionService.run('userPrompt', {
        playerId: playerId,
        prompt: 'Choose order to put back on deck',
        content: {
          type: 'rearrange',
          cardIds: nonVictoryCards.map((card) => card.id),
        },
        actionButtons: [
          { action: 1, label: 'DONE' },
        ],
      }) as { action: number; result: number[] };

      for (const cardId of result.result ?? nonVictoryCards.map((card) => card.id)) {
        console.debug(`[PATROL EFFECT] top-decking ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  'pawn': {
    registerEffects: () => async ({ actionService, playerId }) => {
      const actions = [
        { action: 1, label: '+1 Card' },
        { action: 2, label: '+1 Action' },
        { action: 3, label: '+1 Buy' },
        { action: 4, label: '+1 Treasure' },
      ];

      for (let i = 0; i < 2; i++) {
        console.debug(`[PAWN EFFECT] prompting user to choose...`);

        const result = await actionService.run('userPrompt', {
          playerId,
          actionButtons: actions,
          prompt: 'Choose one',
        }) as { action: number };

        switch (result.action) {
          case 1:
            console.debug(`[PAWN EFFECT] drawing card...`);
            await actionService.run('drawCard', { playerId });
            break;
          case 2:
            console.debug(`[PAWN EFFECT] gaining 1 action...`);
            await actionService.run('gainAction', {
              count: 1,
            });
            break;
          case 3:
            console.debug(`[PAWN EFFECT] gaining 1 buy...`);
            await actionService.run('gainBuy', {
              count: 1,
            });
            break;
          case 4:
            console.debug(`[PAWN EFFECT] gaining 1 treasure...`);
            await actionService.run('gainTreasure', {
              count: 1,
            });
            break;
        }

        actions.splice(actions.findIndex((a) => a.action === result.action), 1);
      }
    },
  },
  'replace': {
    registerEffects: () =>
    async ({
      actionService,
      match,
      cardLibrary,
      playerId,
      reactionContext,
      cardPriceController,
      ...args
    }) => {
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      if (hand.length === 0) {
        console.debug(`[REPLACE EFFECT] no cards in hand to trash...`);
        return;
      }

      console.debug(`[REPLACE EFFECT] prompting user to trash card...`);

      let cardId = await actionService.run('selectSingleCard', {
        prompt: 'Trash card',
        playerId,
        restrict: hand,
        count: 1,
      }) as number | null;
      if (!cardId) {
        console.debug('[REPLACE EFFECT] no card selected to trash');
        return;
      }
      let card = cardLibrary.getCard(cardId);

      console.debug(`[REPLACE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

      await actionService.run('trashCard', {
        playerId,
        cardId,
      });

      const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });

      console.debug(`[REPLACE EFFECT] prompting user to gain a card costing up to ${cardCost.treasure + 2}...`);

      cardId = await actionService.run('selectSingleCard', {
        prompt: 'Gain card',
        playerId,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId, kind: 'upTo', amount: { treasure: cardCost.treasure + 2, potion: cardCost.potion } },
        ],
        count: 1,
      }) as number | null;
      if (!cardId) {
        console.debug('[REPLACE EFFECT] no card selected to gain');
        return;
      }
      card = cardLibrary.getCard(cardId);

      const location = card.type.some((t) => ['ACTION', 'TREASURE'].includes(t)) ? 'playerDeck' : 'playerDiscard';

      console.debug(`[REPLACE EFFECT] gaining ${cardLibrary.getCard(cardId)} to ${location}...`);

      await actionService.run('gainCard', {
        playerId,
        cardId,
        to: { location },
      });

      if (card.type.includes('VICTORY')) {
        console.debug(`[REPLACE EFFECT] card is a victory card`);
        const targets = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match,
        }).filter((id) => !isPlayerImmune(reactionContext, id));

        for (const targetId of targets) {
          const curseCardId = args.findCardService.findCards([{ location: 'basicSupply' }, { cardKeys: 'curse' }])
            ?.slice(-1)?.[0].id;

          if (!curseCardId) {
            console.debug(`[REPLACE EFFECT] no curse cards in supply`);
            break;
          }

          console.debug(
            `[REPLACE EFFECT] ${getPlayerById(match, targetId)} gaining ${cardLibrary.getCard(curseCardId)}`,
          );

          await actionService.run('gainCard', {
            playerId: targetId,
            cardId: curseCardId,
            to: { location: 'playerDiscard' },
          });
        }
      }
    },
  },
  'secret-passage': {
    registerEffects: () => async ({ match, cardLibrary, actionService, playerId, ...args }) => {
      console.debug(`[SECRET PASSAGE EFFECT] drawing 2 cards...`);

      await actionService.run('drawCard', { playerId, count: 2 });

      console.debug(`[SECRET PASSAGE EFFECT] gaining 1 action`);

      await actionService.run('gainAction', { count: 1 });

      const hand = args.cardSourceController.getSource('playerHand', playerId);

      if (hand.length === 0) {
        console.debug(`[SECRET PASSAGE EFFECT] player has no cards in hand`);
        return;
      }

      console.debug(`[SECRET PASSAGE EFFECT] prompting user to select card from hand`);
      const cardId = await actionService.run('selectSingleCard', {
        prompt: 'Choose card',
        playerId,
        restrict: hand,
        count: 1,
      }) as number | null;

      if (!cardId) {
        console.warn(`[SECRET PASSAGE EFFECT] player selected card, but result doesn't have it`);
        return;
      }

      console.debug(`[SECRET PASSAGE EFFECT] player chose ${cardLibrary.getCard(cardId)}`);

      if (args.findCardService.findCards({ location: 'playerDeck', playerId }).length === 0) {
        console.debug(`[SECRET PASSAGE EFFECT] player has no cards in deck, so just putting card on deck`);
        await actionService.run('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerDeck' },
        });
        return;
      }

      console.debug(`[SECRET PASSAGE EFFECT] prompting user to select location in deck`);

      const result = await actionService.run('userPrompt', {
        playerId: playerId,
        actionButtons: [
          { action: 1, label: 'DONE' },
        ],
        prompt: 'Position card',
        content: {
          type: 'blind-rearrange',
          cardIds: args.findCardService.findCards({ location: 'playerDeck', playerId }).map((card) => card.id),
        },
      }) as { action: number; result: number };

      const idx = result.result;

      console.debug(`[SECRET PASSAGE EFFECT] moving card to deck at position ${idx}...`);

      await actionService.run('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: {
          location: 'playerDeck',
          index: idx,
        },
      });
    },
  },
  'shanty-town': {
    registerEffects: () => async ({ actionService, playerId, cardLibrary, match, ...args }) => {
      console.debug(`[SHANTY TOWN EFFECT] gaining 2 actions...`);

      await actionService.run('gainAction', { count: 2 });

      const hand = args.cardSourceController.getSource('playerHand', playerId);

      for (const cardId of hand) {
        console.debug(`[SHANTY TOWN EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('revealCard', {
          cardId,
          playerId,
        });
      }

      if (!hand.some((cardId) => cardLibrary.getCard(cardId).type.includes('ACTION'))) {
        console.debug(`[SHANTY TOWN EFFECT] drawing 2 cards...`);

        await actionService.run('drawCard', { playerId, count: 2 });
      } else {
        console.debug(`[SHANTY TOWN EFFECT] player has actions, not drawing cards`);
      }
    },
  },
  'steward': {
    registerEffects: () => async ({ match, cardLibrary, actionService, playerId, ...args }) => {
      console.debug(`[STEWARD EFFECT] prompting user to choose cards, treasure, or trashing cards`);

      const result = await actionService.run('userPrompt', {
        playerId,
        actionButtons: [
          { action: 1, label: '+2 Card' },
          { action: 2, label: '+2 Treasure' },
          { action: 3, label: 'Trash 2 cards' },
        ],
        prompt: 'Choose one',
      }) as { action: number };

      switch (result.action) {
        case 1:
          console.debug(`[STEWARD EFFECT] drawing 2 carda...`);
          await actionService.run('drawCard', { playerId, count: 2 });
          break;
        case 2:
          console.debug(`[STEWARD EFFECT] gaining 2 treasure...`);
          await actionService.run('gainTreasure', {
            count: 2,
          });
          break;
        case 3: {
          const hand = args.cardSourceController.getSource('playerHand', playerId);

          if (hand.length === 0) {
            console.debug(`[STEWARD EFFECT] no cards in hand to trash`);
            break;
          }

          const count = Math.min(2, hand.length);

          console.debug(`[STEWARD EFFECT] prompting user to trash ${count} cards...`);

          const cardIds = await actionService.run('selectCard', {
            prompt: 'Confirm trash',
            playerId,
            restrict: hand,
            count,
          });

          for (const cardId of cardIds) {
            console.debug(`[STEWARD EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

            await actionService.run('trashCard', {
              playerId,
              cardId,
            });
          }
          break;
        }
      }
    },
  },
  'swindler': {
    registerEffects: () =>
    async ({
      reactionContext,
      actionService,
      playerId,
      match,
      cardLibrary,
      cardPriceController,
      ...args
    }) => {
      console.debug(`[SWINDLER EFFECT] gaining 2 treasure...`);

      await actionService.run('gainTreasure', {
        count: 2,
      });

      const targets = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter((id) => !isPlayerImmune(reactionContext, id));

      console.debug(`[SWINDLER EFFECT] targets in order ${targets.map((id) => getPlayerById(match, id)).join(',')}`);

      for (const target of targets) {
        const deck = args.cardSourceController.getSource('playerDeck', target);

        if (deck.length === 0) {
          console.debug(`[SWINDLER EFFECT] ${getPlayerById(match, target)} as no cards, shuffling`);
          await actionService.run('shuffleDeck', {
            playerId: target,
          });

          if (deck.length === 0) {
            console.debug(`[SWINDLER EFFECT] ${getPlayerById(match, target)} still has no cards`);
            continue;
          }
        }

        let cardId = deck.slice(-1)?.[0];
        const card = cardLibrary.getCard(cardId);

        console.debug(`[SWINDLER EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('trashCard', {
          playerId: target,
          cardId: cardId,
        });

        const { cost } = cardPriceController.applyRules(card, { playerId });

        console.debug(`[SWINDLER EFFECT] prompting user to select card costing ${cost.treasure}...`);

        const cardIdToGain = await actionService.run('selectSingleCard', {
          prompt: 'Choose card',
          playerId,
          restrict: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { playerId, kind: 'exact', amount: cost },
          ],
          count: 1,
        }) as number | null;
        if (!cardIdToGain) {
          console.debug('[SWINDLER EFFECT] no replacement card selected');
          continue;
        }
        cardId = cardIdToGain;

        console.debug(`[SWINDLER EFFECT] ${getPlayerById(match, target)} gaining ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('gainCard', {
          playerId: target,
          cardId,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'torturer': {
    registerEffects: () =>
    async ({
      reactionContext,
      actionService,
      playerId,
      match,
      cardLibrary,
      ...args
    }) => {
      console.debug(`[TORTURER EFFECT] drawing 3 cards...`);

      await actionService.run('drawCard', { playerId, count: 3 });

      const targets = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter((id) => !isPlayerImmune(reactionContext, id));

      console.debug(`[TORTURER EFFECT] targets ${targets.map((id) => getPlayerById(match, id)).join(',')}`);

      // Each other player either discards 2 cards or gains a Curse to their hand,
      // their choice. (They may pick an option they can't do.)",
      for (const target of targets) {
        const player = getPlayerById(match, target);
        console.debug(`[TORTURER EFFECT] prompting ${player} to choose to discard or gain curse to hand...`);

        const result = await actionService.run('userPrompt', {
          playerId: target,
          actionButtons: [
            { action: 1, label: 'DISCARD' },
            { action: 2, label: 'GAIN CURSE' },
          ],
          prompt: 'Choose one',
        }) as { action: number };

        if (result.action === 1) {
          console.debug(`[TORTURER EFFECT] prompting ${player} to discard 2 cards...`);

          const hand = args.cardSourceController.getSource('playerHand', target);

          const cardIds = hand.length < 2 ? hand : await actionService.run('selectCard', {
            prompt: 'Confirm discard',
            playerId: target,
            restrict: hand,
            count: Math.min(2, hand.length),
          });

          for (const cardId of cardIds) {
            console.debug(`[TORTURER EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);

            await actionService.run('discardCard', {
              cardId,
              playerId: target,
            });
          }

          return;
        }

        const curseCardId = args.findCardService.findCards([{ location: 'basicSupply' }, { cardKeys: 'curse' }])
          ?.slice(-1)?.[0]?.id;

        if (!curseCardId) {
          console.debug(`[TORTURER EFFECT] no curse card in supply`);
          continue;
        }

        const card = cardLibrary.getCard(curseCardId);

        console.debug(`[TORTURER EFFECT] gaining ${card}...`);

        await actionService.run('gainCard', {
          playerId: target,
          cardId: card.id,
          to: { location: 'playerHand' },
        });
      }
    },
  },
  'trading-post': {
    registerEffects: () => async ({ actionService, match, cardLibrary, playerId, ...args }) => {
      const count = Math.min(2, args.cardSourceController.getSource('playerHand', playerId).length);

      if (count === 0) {
        console.debug(`[TRADING POST EFFECT] no cards to trash`);
        return;
      }

      console.debug(`[TRADING POST EFFECT] prompting user to trash ${count} cards...`);

      const hand = args.cardSourceController.getSource('playerHand', playerId);
      const cardIds = count < 2 ? hand : await actionService.run('selectCard', {
        prompt: 'Confirm trash',
        playerId,
        restrict: hand,
        count,
      });

      for (const cardId of cardIds) {
        console.debug(`[TRADING POST EFFECT] trashing card ${cardLibrary.getCard(cardId)}`);

        await actionService.run('trashCard', {
          playerId,
          cardId,
        });
      }

      if (cardIds.length === 2) {
        const silverCardId = args.findCardService.findCards([{ location: 'basicSupply' }, { cardKeys: 'silver' }])
          ?.slice(-1)?.[0].id;
        if (!silverCardId) {
          console.debug(`[TRADING POST EFFECT] no silver in supply`);
          return;
        }

        const card = cardLibrary.getCard(silverCardId);

        console.debug(`[TRADING POST EFFECT] gaining ${card}...`);

        await actionService.run('gainCard', {
          playerId,
          cardId: silverCardId,
          to: { location: 'playerHand' },
        });
      } else {
        console.debug(`[TRADING POST EFFECT] player trashed ${cardIds.length}, so no treasure gained`);
      }
    },
  },
  'upgrade': {
    registerEffects: () =>
    async ({
      cardLibrary,
      actionService,
      match,
      playerId,
      cardPriceController,
      ...args
    }) => {
      console.debug(`[UPGRADE EFFECT] drawing card...`);

      await actionService.run('drawCard', { playerId });

      console.debug(`[UPGRADE EFFECT] gaining 1 action...`);

      await actionService.run('gainAction', { count: 1 });

      if (args.cardSourceController.getSource('playerHand', playerId).length === 0) {
        console.debug(`[UPGRADE EFFECT] no cards in hand`);
        return;
      }

      if (args.cardSourceController.getSource('playerHand', playerId).length === 0) {
        console.debug(`[UPGRADE EFFECT] no cards in hand, can't trash`);
        return;
      }

      console.debug(`[UPGRADE EFFECT] prompting user to trash card from hand...`);

      let cardIdToTrash = await actionService.run('selectSingleCard', {
        prompt: 'Confirm trash',
        playerId,
        restrict: args.cardSourceController.getSource('playerHand', playerId),
        count: 1,
      }) as number | null;
      if (!cardIdToTrash) {
        console.debug('[UPGRADE EFFECT] no card selected to trash');
        return;
      }

      const card = cardLibrary.getCard(cardIdToTrash);

      console.debug(`[UPGRADE EFFECT] trashing ${card}...`);

      await actionService.run('trashCard', {
        playerId,
        cardId: cardIdToTrash,
      });

      const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });

      console.debug(`[UPGRADE EFFECT] prompting user to select card costing ${cardCost.treasure + 2}...`);

      const cardId = await actionService.run('selectSingleCard', {
        prompt: 'Gain card',
        playerId,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId, kind: 'exact', amount: { treasure: cardCost.treasure + 1, potion: cardCost.potion } },
        ],
        count: 1,
      }) as number | null;
      if (!cardId) {
        console.debug('[UPGRADE EFFECT] no gain card selected');
        return;
      }

      console.debug(`[UPGRADE EFFECT] gaining ${cardLibrary.getCard(cardId)} to hand...`);

      await actionService.run('gainCard', {
        playerId,
        cardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'wishing-well': {
    registerEffects: () => async ({ match, cardLibrary, actionService, playerId, ...args }) => {
      console.debug(`[WISHING WELL EFFECT] drawing card...`);

      await actionService.run('drawCard', { playerId });

      console.debug(`[WISHING WELL EFFECT] gaining 1 action...`);

      await actionService.run('gainAction', { count: 1 });

      // Name a card, then reveal the top card of your deck. If you named it, put it into your hand."
      console.debug(`[WISHING WELL EFFECT] prompting user to name a card...`);

      const result = await actionService.run('userPrompt', {
        playerId,
        content: { type: 'name-card' },
        prompt: 'Name a card',
      }) as { action: number; result: CardKey };

      const cardKey: CardKey = result.result;

      console.debug(`[WISHING WELL EFFECT] player named '${cardKey}'`);

      if (args.findCardService.findCards({ location: 'playerDeck', playerId }).length === 0) {
        console.debug(`[WISHING WELL EFFECT] shuffling player's deck...`);

        await actionService.run('shuffleDeck', {
          playerId,
        });
      }

      const cardId = args.findCardService.findCards({ location: 'playerDeck', playerId }).slice(-1)[0]?.id;

      console.debug(`[WISHING WELL EFFECT] revealing card ${cardLibrary.getCard(cardId)}...`);

      await actionService.run('revealCard', {
        cardId,
        playerId,
      });

      const card = cardLibrary.getCard(cardId);
      if (card.cardKey === cardKey) {
        console.debug(`[WISHING WELL EFFECT] moving ${card} to hand`);

        await actionService.run('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerHand' },
        });
      }
    },
  },
};

export default expansionModule;
