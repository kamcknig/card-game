import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { Card, CardId, CardKey, PlayerId } from 'shared/types/index.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';
import { resolveChooseAbilities } from '../../utils/resolve-choose-abilities.ts';
import { getAttackTargets } from '../../utils/get-attack-targets.ts';
import { revealTopDeckCards } from '../../utils/reveal-top-deck-cards.ts';

const expansionModule: CardExpansionModule = {
  baron: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, cardLibrary, match, playerId, ...args }) => {
        // +1 Buy
        // You may discard an Estate for +$4. If you don't, gain an Estate.

        loggerService.debug(`[BARON EFFECT] gaining 1 buy...`);

        await actionService.run('gainBuy', {
          count: 1,
        });

        const hand = args.cardSourceController.getSource('playerHand', playerId);

        const handEstateIdx = hand.findLast(cId => cardLibrary.getCard(cId).cardKey === 'estate');

        const supplyEstateCard = args.findCardService.findTopSupplyCardForPileKey({
          pileKey: 'estate',
          from: 'basicSupply',
        });

        if (!handEstateIdx) {
          loggerService.debug(`[BARON EFFECT] player has no estates in hand, they gain one`);

          if (!supplyEstateCard) {
            loggerService.debug(`[BARON EFFECT] no estates in supply`);
            return;
          }
        } else {
          loggerService.debug(`[BARON EFFECT] player has an estate in hand`);

          const confirm = (await actionService.run('userPrompt', {
            playerId,
            prompt: 'Discard estate?',
            actionButtons: [
              { label: `DON'T DISCARD`, action: 1 },
              { label: 'DISCARD', action: 2 },
            ],
          })) as { action: number };

          if (confirm.action === 2) {
            loggerService.debug(`[BARON EFFECT] player chooses to discard estate, gain 4 treasure`);

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

        if (!supplyEstateCard) {
          loggerService.debug(`[BARON EFFECT] no estate in supply`);
          return;
        }

        loggerService.debug(`[BARON EFFECT] player not discarding estate, gaining an estate...`);

        await args.supplyGainService.gainTopSupplyCardForPileKey({
          playerId,
          pileKey: 'estate',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'baron effect',
        });
      },
  },
  bridge: {
    registerEffects:
      () =>
      async ({ loggerService, reactionManager, cardLibrary, actionService, cardPriceController, cardId, playerId }) => {
        loggerService.debug(`[BRIDGE EFFECT] gaining 1 buy...`);

        await actionService.run('gainBuy', { count: 1 });

        loggerService.debug(`[BRIDGE EFFECT] gaining 1 treasure...`);

        await actionService.run('gainTreasure', {
          count: 1,
        });

        loggerService.debug(`[BRIDGE EFFECT] modify cost by -1 of all cards...`);

        const allCards = cardLibrary.getAllCardsAsArray();
        const ruleCleanups: (() => void)[] = [];
        for (const card of allCards) {
          ruleCleanups.push(
            cardPriceController.registerRule(card, (card, context) => {
              return { restricted: false, cost: { treasure: -1 } };
            }),
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
  conspirator: {
    registerEffects:
      () =>
      async ({ loggerService, match, cardLibrary, playerId, actionService }) => {
        loggerService.debug(`[CONSPIRATOR EFFECT] gaining 2 treasure...`);

        await actionService.run('gainTreasure', { count: 2 });

        // we want those cards played on the player's turn that are actions and played by THAT player
        const actionCardCount = Object.keys(match.stats.playedCards).filter(
          cardId =>
            cardLibrary.getCard(+cardId).type.includes('ACTION') &&
            match.stats.playedCards[+cardId].playerId === playerId,
        );

        loggerService.debug(`[CONSPIRATOR EFFECT] action cards played so far ${actionCardCount.length}`);

        if (actionCardCount?.length >= 3) {
          loggerService.debug(`[CONSPIRATOR EFFECT] drawing card...`);

          await actionService.run('drawCard', { playerId });

          loggerService.debug(`[CONSPIRATOR EFFECT] gaining 1 action...`);

          await actionService.run('gainAction', {
            count: 1,
          });
        }
      },
  },
  courtier: {
    registerEffects:
      () =>
      async ({ loggerService, match, playerId, cardLibrary, actionService, ...args }) => {
        const hand = args.cardSourceController.getSource('playerHand', playerId);

        if (!hand.length) {
          loggerService.debug(`[COURTIER EFFECT] no cards in hand`);
          return;
        }

        loggerService.debug(`[COURTIER EFFECT] prompting user to reveal a card...`);

        const cardId = (await actionService.run('selectSingleCard', {
          prompt: 'Reveal card',
          count: 1,
          playerId,
          restrict: hand,
        })) as number | null;
        if (!cardId) {
          loggerService.debug('[COURTIER EFFECT] no card selected to reveal');
          return;
        }

        loggerService.debug(`[COURTIER EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('revealCard', {
          cardId,
          playerId,
        });

        let cardTypeCount = cardLibrary.getCard(cardId).type.length;

        loggerService.debug(`[COURTIER EFFECT] card has ${cardTypeCount} types`);

        cardTypeCount = Math.min(cardTypeCount, 4);

        loggerService.debug(`[COURTIER EFFECT] final choice count ${cardTypeCount}`);

        await resolveChooseAbilities({
          context: {
            cardId: args.cardId,
            playerId,
            promptService: args.promptService,
            loggerService,
            reactionContext: args.reactionContext,
          },
          logTag: 'COURTIER EFFECT',
          prompt: 'Choose one',
          baseChoiceCount: cardTypeCount,
          options: [
            {
              label: '+1 Action',
              action: 1,
              resolve: async () => {
                loggerService.debug('[COURTIER EFFECT] gaining 1 action...');
                await actionService.run('gainAction', {
                  count: 1,
                });
              },
            },
            {
              label: '+1 Buy',
              action: 2,
              resolve: async () => {
                loggerService.debug('[COURTIER EFFECT] gaining 1 buy...');
                await actionService.run('gainBuy', {
                  count: 1,
                });
              },
            },
            {
              label: '+3 Treasure',
              action: 3,
              resolve: async () => {
                loggerService.debug('[COURTIER EFFECT] gaining 3 treasure...');
                await actionService.run('gainTreasure', {
                  count: 3,
                });
              },
            },
            {
              label: 'Gain a gold',
              action: 4,
              resolve: async () => {
                const gainedGoldId = await args.supplyGainService.gainTopSupplyCardForPileKey({
                  playerId,
                  pileKey: 'gold',
                  from: 'basicSupply',
                  to: { location: 'playerDiscard' },
                  logTag: 'courtier effect',
                });

                if (!gainedGoldId) {
                  loggerService.debug('[COURTIER EFFECT] no gold in supply...');
                }
              },
            },
          ],
        });
      },
  },
  courtyard: {
    registerEffects:
      () =>
      async ({ loggerService, match, actionService, playerId, cardLibrary, ...args }) => {
        loggerService.debug(`[COURTYARD EFFECT] drawing 3 cards...`);

        await actionService.run('drawCard', { playerId, count: 3 });

        const hand = args.cardSourceController.getSource('playerHand', playerId);

        if (!hand.length) {
          loggerService.debug(`[COURTYARD EFFECT] no cards in hand`);
          return;
        }

        loggerService.debug(`[COURTYARD EFFECT] prompting user to put card onto deck...`);

        const cardId = (await actionService.run('selectSingleCard', {
          prompt: 'Top deck',
          count: 1,
          playerId,
          restrict: args.cardSourceController.getSource('playerHand', playerId),
        })) as number | null;
        if (!cardId) {
          loggerService.debug('[COURTYARD EFFECT] no card selected to top-deck');
          return;
        }

        loggerService.debug(`[COURTYARD EFFECT] moving ${cardLibrary.getCard(cardId)} to top of deck...`);

        await actionService.run('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerDeck' },
        });
      },
  },
  diplomat: {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ loggerService, reactionManager, actionService, ...args }, { playerId, cardId }) => {
        reactionManager.registerReactionTemplate({
          id: `diplomat:${cardId}:cardPlayed`,
          playerId,
          listeningFor: 'cardPlayed',
          condition: ({ match, trigger, cardLibrary, ...args }) => {
            return (
              cardLibrary.getCard(trigger.args.cardId!).type.includes('ATTACK') &&
              args.cardSourceController.getSource('playerHand', playerId).length >= 5 &&
              trigger.args.playerId !== playerId
            );
          },
          triggeredEffectFn: async function ({ reaction, cardLibrary }) {
            const sourceId = reaction.getSourceId();

            loggerService.debug(`[diplomat triggered effect] running for ${cardLibrary.getCard(cardId)}`);

            await actionService.run('revealCard', {
              cardId: sourceId,
              playerId,
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
    registerEffects:
      () =>
      async ({ loggerService, match, actionService, playerId, ...args }) => {
        loggerService.debug(`[DIPLOMAT EFFECT] drawing 2 cards...`);

        await actionService.run('drawCard', { playerId, count: 2 });

        const cardCount = args.cardSourceController.getSource('playerHand', playerId).length;

        if (cardCount <= 5) {
          loggerService.debug(`[DIPLOMAT EFFECT] gaining 2 actions...`);

          await actionService.run('gainAction', { count: 2 });
        } else {
          loggerService.debug(
            `[DIPLOMAT EFFECT] player has more than ${cardCount} cards in hand, can't perform diplomat`,
          );
        }
      },
  },
  duke: {
    registerScoringFunction:
      () =>
      ({ match, cardLibrary, ownerId, ...args }) => {
        const duchies = args.findCardService.findCards({ all: [{ owner: ownerId }, { cardKeys: 'duchy' }] });

        args.loggerService.debug(
          `[DUKE SCORING] player ${getPlayerById(match, ownerId)} has ${duchies.length} Duchies`,
        );

        return duchies.length;
      },
    registerEffects:
      () =>
      async ({ loggerService }) => {
        loggerService.debug(`[DUKE EFFECT] duke has no effects`);
      },
  },
  farm: {
    registerEffects:
      () =>
      async ({ loggerService, actionService }) => {
        loggerService.debug(`[FARM EFFECT] gaining 2 treasure...`);

        await actionService.run('gainTreasure', {
          count: 2,
        });
      },
  },
  ironworks: {
    registerEffects:
      () =>
      async ({ loggerService, cardLibrary, actionService, playerId, ...args }) => {
        loggerService.debug(`[IRONWORKS EFFECT] prompting user to choose card costing up to 4...`);

        const cardId = (await actionService.run('selectSingleCard', {
          prompt: 'Choose card',
          count: 1,
          restrict: {
            all: [{ location: ['basicSupply', 'kingdomSupply'] }, { playerId, amount: { treasure: 4 }, kind: 'upTo' }],
          },
          playerId,
        })) as number | null;
        if (!cardId) {
          loggerService.debug('[IRONWORKS EFFECT] no card selected to gain');
          return;
        }

        loggerService.debug(`[IRONWORKS EFFECT] gaining ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('gainCard', {
          cardId,
          playerId,
          to: { location: 'playerDiscard' },
        });

        const card = cardLibrary.getCard(cardId);

        if (card.type.includes('ACTION')) {
          loggerService.debug(`[IRONWORKS EFFECT] card is an action, gaining 1 action...`);

          await actionService.run('gainAction', {
            count: 1,
          });
        }

        if (card.type.includes('TREASURE')) {
          loggerService.debug(`[IRONWORKS EFFECT] card is a treasure, gaining 1 treasure...`);

          await actionService.run('gainTreasure', {
            count: 1,
          });
        }

        if (card.type.includes('VICTORY')) {
          loggerService.debug(`[IRONWORKS EFFECT] card is a victory, drawing card...`);

          await actionService.run('drawCard', { playerId });
        }
      },
  },
  lurker: {
    registerEffects:
      () =>
      async ({ loggerService, cardLibrary, match, playerId, actionService, ...args }) => {
        loggerService.debug(`[LURKER EFFECT] gaining 1 action...`);

        await actionService.run('gainAction', { count: 1 });

        await resolveChooseAbilities({
          context: {
            cardId: args.cardId,
            playerId,
            promptService: args.promptService,
            loggerService,
            reactionContext: args.reactionContext,
          },
          logTag: 'LURKER EFFECT',
          prompt: 'Choose one',
          baseChoiceCount: 1,
          options: [
            {
              action: 1,
              label: 'TRASH CARD',
              resolve: async () => {
                loggerService.debug('[LURKER EFFECT] prompting user to select card to trash...');

                const cardId = (await actionService.run('selectSingleCard', {
                  prompt: 'Confirm trash',
                  playerId,
                  count: 1,
                  restrict: { all: [{ location: ['basicSupply', 'kingdomSupply'] }, { cardType: 'ACTION' }] },
                })) as number | null;
                if (!cardId) {
                  loggerService.debug('[LURKER EFFECT] no action card selected to trash');
                  return;
                }

                loggerService.debug(`[LURKER EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

                await actionService.run('trashCard', {
                  cardId,
                  playerId,
                });
              },
            },
            {
              action: 2,
              label: 'GAIN CARD',
              resolve: async () => {
                const trash = args.findCardService.findCards({ location: 'trash' });
                const actionCardIds = trash.filter(cardId => cardId.type.includes('ACTION'));

                if (!actionCardIds.length) {
                  loggerService.debug('[LURKER EFFECT] trash has no action cards');
                  return;
                }

                if (!trash.some(cId => cId.type.includes('ACTION'))) {
                  loggerService.debug('[LURKER EFFECT] no action cards in trash, skipping gaining');
                  return;
                }

                let cardId: CardId;
                if (args.findCardService.findCards({ location: 'trash' }).length === 1) {
                  loggerService.debug('[LURKER EFFECT] only one card in trash, gaining automatically');
                  cardId = trash[0].id;
                } else {
                  loggerService.debug('[LURKER EFFECT] prompting user to select action card to gain...');

                  const selectedCardId = await args.promptService.selectSingleCardFromPrompt({
                    prompt: 'Choose card to gain',
                    playerId,
                    content: {
                      type: 'select',
                      selectCount: 1,
                      cardIds: actionCardIds.map(card => card.id),
                    },
                  });

                  if (!selectedCardId) {
                    return;
                  }
                  cardId = selectedCardId;
                }

                loggerService.debug(`[LURKER EFFECT] gaining ${cardLibrary.getCard(cardId)}...`);

                await actionService.run('gainCard', {
                  cardId,
                  playerId,
                  to: { location: 'playerDiscard' },
                });
              },
            },
          ],
        });
      },
  },
  masquerade: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, playerId, match, cardLibrary, ...args }) => {
        loggerService.debug(`[masquerade effect] drawing 2 cards...`);

        await actionService.run('drawCard', { playerId, count: 2 });

        const targets = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL',
          match,
        }).filter(playerId => args.cardSourceController.getSource('playerHand', playerId).length > 0);

        loggerService.debug(
          `[masquerade effect] targets in order ${targets.map(t => getPlayerById(match, t)).join(',')}`,
        );

        const playerCardMap = new Map<PlayerId, CardId>();

        for (const playerId of targets) {
          loggerService.debug(`[masquerade effect] prompting ${getPlayerById(match, playerId)} to choose a card...`);

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

          loggerService.debug(
            `[masquerade effect] ${getPlayerById(match, playerId)} chose ${cardLibrary.getCard(selectedCardId)}`,
          );
        }

        for (let i = 0; i < targets.length; i++) {
          const cardId = playerCardMap.get(targets[i]);

          if (!cardId) {
            loggerService.warn(`[masquerade effect] no card for ${getPlayerById(match, targets[i])}`);
            continue;
          }

          const playerId = targets[(i + 1) % targets.length];

          loggerService.debug(
            `[masquerade effect] moving ${cardLibrary.getCard(cardId!)} to ${getPlayerById(match, playerId!)}`,
          );

          // Ownership transfers to the receiving player — route it through the
          // action layer via moveCard's opt-in flag instead of mutating the
          // card directly here.
          await actionService.run('moveCard', {
            cardId: cardId!,
            toPlayerId: playerId!,
            to: { location: 'playerHand' },
            updateOwner: true,
          });
        }

        loggerService.debug(`[masquerade effect] prompting user to trash card from hand...`);

        const selectedCardId = await actionService.run('selectSingleCard', {
          optional: true,
          prompt: 'Confirm trash',
          count: 1,
          playerId,
          restrict: args.cardSourceController.getSource('playerHand', playerId),
        });

        loggerService.debug(
          `[masquerade effect] player chose ${selectedCardId ? cardLibrary.getCard(selectedCardId) : 'not to trash'}`,
        );

        if (selectedCardId) {
          loggerService.debug(`[masquerade effect] trashing ${cardLibrary.getCard(selectedCardId)}...`);

          await actionService.run('trashCard', {
            cardId: selectedCardId,
            playerId,
          });
        }
      },
  },
  mill: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, playerId, match, cardLibrary, ...args }) => {
        loggerService.debug(`[MILL EFFECT] drawing card...`);

        await actionService.run('drawCard', { playerId });

        loggerService.debug(`[MILL EFFECT] gaining 1 action...`);

        await actionService.run('gainAction', { count: 1 });

        const hand = args.cardSourceController.getSource('playerHand', playerId);

        if (hand.length === 0) {
          loggerService.debug(`[MILL EFFECT] player has no cards in hand`);
          return;
        }

        loggerService.debug(`[MILL EFFECT] prompting user to select cards to discard`);

        const results = await actionService.run('selectCard', {
          optional: true,
          prompt: 'Confirm discard',
          playerId,
          restrict: hand,
          count: Math.min(2, hand.length),
        });

        for (const cardId of results) {
          loggerService.debug(`[MILL EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);

          await actionService.run('discardCard', {
            cardId,
            playerId,
          });
        }

        loggerService.debug(`[MILL EFFECT] gaining 2 treasure...`);

        if (results.length == 2) {
          await actionService.run('gainTreasure', {
            count: 2,
          });
        }
      },
  },
  'mining-village': {
    registerEffects:
      () =>
      async ({ loggerService, actionService, playerId, cardId, cardLibrary }) => {
        loggerService.debug(`[MINING VILLAGE EFFECT] drawing card...`);

        await actionService.run('drawCard', { playerId });

        loggerService.debug(`[MINING VILLAGE EFFECT] gaining 2 actions`);

        await actionService.run('gainAction', { count: 2 });

        loggerService.debug(`[MINING VILLAGE EFFECT] prompting user to trash mining village or not`);
        const results = (await actionService.run('userPrompt', {
          playerId,
          actionButtons: [
            { action: 1, label: `DON'T TRASH` },
            { action: 2, label: 'TRASH' },
          ],
          prompt: 'Trash Mining Village?',
        })) as { action: number };

        if (results.action === 2) {
          loggerService.debug(`[MINING VILLAGE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

          await actionService.run('trashCard', {
            playerId,
            cardId,
          });

          loggerService.debug(`[MINING VILLAGE EFFECT] gaining 2 treasure...`);

          await actionService.run('gainTreasure', {
            count: 2,
          });
        } else {
          loggerService.debug(`[MINING VILLAGE EFFECT] player chose not to trash mining village`);
        }
      },
  },
  minion: {
    registerEffects:
      () =>
      async ({ loggerService, match, reactionContext, cardLibrary, actionService, playerId, ...args }) => {
        loggerService.debug(`[MINION EFFECT] gaining 1 action...`);

        await actionService.run('gainAction', { count: 1 });

        await resolveChooseAbilities({
          context: {
            cardId: args.cardId,
            playerId,
            promptService: args.promptService,
            loggerService,
            reactionContext,
          },
          logTag: 'MINION EFFECT',
          prompt: 'Choose one',
          baseChoiceCount: 1,
          options: [
            {
              action: 1,
              label: '+2 Treasure',
              resolve: async () => {
                loggerService.debug('[MINION EFFECT] gaining 2 treasure...');
                await actionService.run('gainTreasure', {
                  count: 2,
                });
              },
            },
            {
              action: 2,
              label: 'Discard hand',
              resolve: async () => {
                const attackerPlayerId = playerId;
                const targets = findOrderedTargets({
                  startingPlayerId: attackerPlayerId,
                  appliesTo: 'ALL',
                  match,
                }).filter(targetPlayerId => {
                  const hand = args.cardSourceController.getSource('playerHand', targetPlayerId);
                  const handCount = hand.length;
                  return (
                    targetPlayerId === attackerPlayerId ||
                    (handCount >= 5 && !isPlayerImmune(reactionContext, targetPlayerId))
                  );
                });

                for (const targetPlayerId of targets) {
                  const player = getPlayerById(match, targetPlayerId);
                  const hand = args.cardSourceController.getSource('playerHand', targetPlayerId);
                  const l = hand.length;
                  for (let i = l - 1; i >= 0; i--) {
                    const cardId = hand[i];

                    loggerService.debug(`[MINION EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);

                    await actionService.run('discardCard', {
                      cardId,
                      playerId: targetPlayerId,
                    });
                  }

                  loggerService.debug(`[MINION EFFECT] ${player} drawing 4 cards...`);

                  await actionService.run('drawCard', { playerId: targetPlayerId, count: 4 });
                }
              },
            },
          ],
        });
      },
  },
  nobles: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, playerId, ...args }) => {
        loggerService.debug(`[NOBLES EFFECT] prompting user to select actions or treasure`);

        await resolveChooseAbilities({
          context: {
            cardId: args.cardId,
            playerId,
            promptService: args.promptService,
            loggerService,
            reactionContext: args.reactionContext,
          },
          logTag: 'NOBLES EFFECT',
          prompt: 'Choose one',
          baseChoiceCount: 1,
          options: [
            {
              action: 1,
              label: '+3 Cards',
              resolve: async () => {
                loggerService.debug('[NOBLES EFFECT] drawing 3 cards...');
                await actionService.run('drawCard', { playerId, count: 3 });
              },
            },
            {
              action: 2,
              label: '+2 Actions',
              resolve: async () => {
                loggerService.debug('[NOBLES EFFECT] gaining 2 actions');
                await actionService.run('gainAction', {
                  count: 2,
                });
              },
            },
          ],
        });
      },
  },
  patrol: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, match, playerId, cardLibrary, ...args }) => {
        loggerService.debug(`[PATROL EFFECT] drawing 3 cards`);

        await actionService.run('drawCard', { playerId, count: 3 });

        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        const discard = args.cardSourceController.getSource('playerDiscard', playerId);

        loggerService.debug(`[PATROL EFFECT] original num to reveal 4`);

        const numToReveal = Math.min(4, deck.length + discard.length);

        loggerService.debug(`[PATROL EFFECT] final num to reveal ${numToReveal}`);

        if (numToReveal === 0) {
          loggerService.debug(`[PATROL EFFECT] no cards to reveal`);
          return;
        }

        // Reveal the top numToReveal cards of the deck, set aside — shuffling
        // the discard back in automatically if the deck runs dry mid-reveal.
        const revealedCardIds: Card[] = await revealTopDeckCards(
          { actionService, cardLibrary, loggerService },
          playerId,
          numToReveal,
          { setAside: true },
        );

        const [victoryCards, nonVictoryCards] = revealedCardIds.reduce(
          (prev, card) => {
            if (card.type.includes('VICTORY') || card.cardKey === 'curse') {
              prev[0].push(card);
            } else {
              prev[1].push(card);
            }
            return prev;
          },
          [[], []] as Card[][],
        );

        for (const card of victoryCards) {
          loggerService.debug(`[PATROL EFFECT] moving ${card} to hand...`);

          await actionService.run('moveCard', {
            cardId: card.id,
            toPlayerId: playerId,
            to: { location: 'playerHand' },
          });
        }

        if (nonVictoryCards.length < 2) {
          if (nonVictoryCards.length === 1) {
            loggerService.debug(
              `[PATROL EFFECT] non-victory card count is ${nonVictoryCards.length}, no need to rearrange`,
            );
            await actionService.run('moveCard', {
              cardId: nonVictoryCards[0].id,
              to: { location: 'playerDeck' },
            });
          }

          return;
        }

        loggerService.debug(`[PATROL EFFECT] prompting user to rearrange cards...`);

        const result = (await actionService.run('userPrompt', {
          playerId: playerId,
          prompt: 'Choose order to put back on deck',
          content: {
            type: 'rearrange',
            cardIds: nonVictoryCards.map(card => card.id),
          },
          actionButtons: [{ action: 1, label: 'DONE' }],
        })) as { action: number; result: number[] };

        for (const cardId of result.result ?? nonVictoryCards.map(card => card.id)) {
          loggerService.debug(`[PATROL EFFECT] top-decking ${cardLibrary.getCard(cardId)}...`);

          await actionService.run('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: { location: 'playerDeck' },
          });
        }
      },
  },
  pawn: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, playerId, ...args }) => {
        await resolveChooseAbilities({
          context: {
            cardId: args.cardId,
            playerId,
            promptService: args.promptService,
            loggerService,
            reactionContext: args.reactionContext,
          },
          logTag: 'PAWN EFFECT',
          prompt: 'Choose one',
          baseChoiceCount: 2,
          options: [
            {
              action: 1,
              label: '+1 Card',
              resolve: async () => {
                loggerService.debug('[PAWN EFFECT] drawing card...');
                await actionService.run('drawCard', { playerId });
              },
            },
            {
              action: 2,
              label: '+1 Action',
              resolve: async () => {
                loggerService.debug('[PAWN EFFECT] gaining 1 action...');
                await actionService.run('gainAction', {
                  count: 1,
                });
              },
            },
            {
              action: 3,
              label: '+1 Buy',
              resolve: async () => {
                loggerService.debug('[PAWN EFFECT] gaining 1 buy...');
                await actionService.run('gainBuy', {
                  count: 1,
                });
              },
            },
            {
              action: 4,
              label: '+1 Treasure',
              resolve: async () => {
                loggerService.debug('[PAWN EFFECT] gaining 1 treasure...');
                await actionService.run('gainTreasure', {
                  count: 1,
                });
              },
            },
          ],
        });
      },
  },
  replace: {
    registerEffects:
      () =>
      async ({
        loggerService,
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
          loggerService.debug(`[REPLACE EFFECT] no cards in hand to trash...`);
          return;
        }

        loggerService.debug(`[REPLACE EFFECT] prompting user to trash card...`);

        let cardId = (await actionService.run('selectSingleCard', {
          prompt: 'Trash card',
          playerId,
          restrict: hand,
          count: 1,
        })) as number | null;
        if (!cardId) {
          loggerService.debug('[REPLACE EFFECT] no card selected to trash');
          return;
        }
        let card = cardLibrary.getCard(cardId);

        loggerService.debug(`[REPLACE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('trashCard', {
          playerId,
          cardId,
        });

        const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });

        loggerService.debug(`[REPLACE EFFECT] prompting user to gain a card costing up to ${cardCost.treasure + 2}...`);

        cardId = (await actionService.run('selectSingleCard', {
          prompt: 'Gain card',
          playerId,
          restrict: {
            all: [
              { location: ['basicSupply', 'kingdomSupply'] },
              { playerId, kind: 'upTo', amount: { treasure: cardCost.treasure + 2, potion: cardCost.potion } },
            ],
          },
          count: 1,
        })) as number | null;
        if (!cardId) {
          loggerService.debug('[REPLACE EFFECT] no card selected to gain');
          return;
        }
        card = cardLibrary.getCard(cardId);

        const location = card.type.some(t => ['ACTION', 'TREASURE'].includes(t)) ? 'playerDeck' : 'playerDiscard';

        loggerService.debug(`[REPLACE EFFECT] gaining ${cardLibrary.getCard(cardId)} to ${location}...`);

        await actionService.run('gainCard', {
          playerId,
          cardId,
          to: { location },
        });

        if (card.type.includes('VICTORY')) {
          loggerService.debug(`[REPLACE EFFECT] card is a victory card`);
          const targets = getAttackTargets(match, playerId, reactionContext);

          for (const targetId of targets) {
            loggerService.debug(`[REPLACE EFFECT] ${getPlayerById(match, targetId)} gaining a curse`);

            const gainedCurseId = await args.supplyGainService.gainTopSupplyCardForPileKey({
              playerId: targetId,
              pileKey: 'curse',
              from: 'basicSupply',
              to: { location: 'playerDiscard' },
              logTag: 'replace effect',
            });

            if (!gainedCurseId) {
              loggerService.debug(`[REPLACE EFFECT] no curse cards in supply`);
              break;
            }
          }
        }
      },
  },
  'secret-passage': {
    registerEffects:
      () =>
      async ({ loggerService, match, cardLibrary, actionService, playerId, ...args }) => {
        loggerService.debug(`[SECRET PASSAGE EFFECT] drawing 2 cards...`);

        await actionService.run('drawCard', { playerId, count: 2 });

        loggerService.debug(`[SECRET PASSAGE EFFECT] gaining 1 action`);

        await actionService.run('gainAction', { count: 1 });

        const hand = args.cardSourceController.getSource('playerHand', playerId);

        if (hand.length === 0) {
          loggerService.debug(`[SECRET PASSAGE EFFECT] player has no cards in hand`);
          return;
        }

        loggerService.debug(`[SECRET PASSAGE EFFECT] prompting user to select card from hand`);
        const cardId = (await actionService.run('selectSingleCard', {
          prompt: 'Choose card',
          playerId,
          restrict: hand,
          count: 1,
        })) as number | null;

        if (!cardId) {
          loggerService.warn(`[SECRET PASSAGE EFFECT] player selected card, but result doesn't have it`);
          return;
        }

        loggerService.debug(`[SECRET PASSAGE EFFECT] player chose ${cardLibrary.getCard(cardId)}`);

        if (args.findCardService.findCards({ location: 'playerDeck', playerId }).length === 0) {
          loggerService.debug(`[SECRET PASSAGE EFFECT] player has no cards in deck, so just putting card on deck`);
          await actionService.run('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: { location: 'playerDeck' },
          });
          return;
        }

        loggerService.debug(`[SECRET PASSAGE EFFECT] prompting user to select location in deck`);

        const result = (await actionService.run('userPrompt', {
          playerId: playerId,
          actionButtons: [{ action: 1, label: 'DONE' }],
          prompt: 'Position card',
          content: {
            type: 'blind-rearrange',
            cardIds: args.findCardService.findCards({ location: 'playerDeck', playerId }).map(card => card.id),
          },
        })) as { action: number; result: number };

        const idx = result.result;

        loggerService.debug(`[SECRET PASSAGE EFFECT] moving card to deck at position ${idx}...`);

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
    registerEffects:
      () =>
      async ({ loggerService, actionService, playerId, cardLibrary, match, ...args }) => {
        loggerService.debug(`[SHANTY TOWN EFFECT] gaining 2 actions...`);

        await actionService.run('gainAction', { count: 2 });

        const hand = args.cardSourceController.getSource('playerHand', playerId);

        for (const cardId of hand) {
          loggerService.debug(`[SHANTY TOWN EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);

          await actionService.run('revealCard', {
            cardId,
            playerId,
          });
        }

        if (!hand.some(cardId => cardLibrary.getCard(cardId).type.includes('ACTION'))) {
          loggerService.debug(`[SHANTY TOWN EFFECT] drawing 2 cards...`);

          await actionService.run('drawCard', { playerId, count: 2 });
        } else {
          loggerService.debug(`[SHANTY TOWN EFFECT] player has actions, not drawing cards`);
        }
      },
  },
  steward: {
    registerEffects:
      () =>
      async ({ loggerService, match, cardLibrary, actionService, playerId, ...args }) => {
        loggerService.debug(`[STEWARD EFFECT] prompting user to choose cards, treasure, or trashing cards`);

        await resolveChooseAbilities({
          context: {
            cardId: args.cardId,
            playerId,
            promptService: args.promptService,
            loggerService,
            reactionContext: args.reactionContext,
          },
          logTag: 'STEWARD EFFECT',
          prompt: 'Choose one',
          baseChoiceCount: 1,
          options: [
            {
              action: 1,
              label: '+2 Card',
              resolve: async () => {
                loggerService.debug('[STEWARD EFFECT] drawing 2 cards...');
                await actionService.run('drawCard', { playerId, count: 2 });
              },
            },
            {
              action: 2,
              label: '+2 Treasure',
              resolve: async () => {
                loggerService.debug('[STEWARD EFFECT] gaining 2 treasure...');
                await actionService.run('gainTreasure', {
                  count: 2,
                });
              },
            },
            {
              action: 3,
              label: 'Trash 2 cards',
              resolve: async () => {
                const hand = args.cardSourceController.getSource('playerHand', playerId);

                if (hand.length === 0) {
                  loggerService.debug('[STEWARD EFFECT] no cards in hand to trash');
                  return;
                }

                const count = Math.min(2, hand.length);

                loggerService.debug(`[STEWARD EFFECT] prompting user to trash ${count} cards...`);

                const cardIds = await actionService.run('selectCard', {
                  prompt: 'Confirm trash',
                  playerId,
                  restrict: hand,
                  count,
                });

                for (const cardId of cardIds) {
                  loggerService.debug(`[STEWARD EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

                  await actionService.run('trashCard', {
                    playerId,
                    cardId,
                  });
                }
              },
            },
          ],
        });
      },
  },
  swindler: {
    registerEffects:
      () =>
      async ({ loggerService, reactionContext, actionService, playerId, match, cardLibrary, cardPriceController }) => {
        loggerService.debug(`[SWINDLER EFFECT] gaining 2 treasure...`);

        await actionService.run('gainTreasure', {
          count: 2,
        });

        const targets = getAttackTargets(match, playerId, reactionContext);

        loggerService.debug(
          `[SWINDLER EFFECT] targets in order ${targets.map(id => getPlayerById(match, id)).join(',')}`,
        );

        for (const target of targets) {
          // Reveal the top card of the target's deck, shuffling the discard
          // in automatically if the deck is empty. Returning the actual
          // revealed Card directly avoids re-deriving the id from a stale
          // read of the deck array after the shuffle has mutated it.
          const revealed = await revealTopDeckCards({ actionService, cardLibrary, loggerService }, target, 1);
          const card = revealed[0];

          if (!card) {
            loggerService.debug(`[SWINDLER EFFECT] ${getPlayerById(match, target)} still has no cards`);
            continue;
          }

          loggerService.debug(`[SWINDLER EFFECT] trashing ${card}...`);

          await actionService.run('trashCard', {
            playerId: target,
            cardId: card.id,
          });

          const { cost } = cardPriceController.applyRules(card, { playerId });

          loggerService.debug(`[SWINDLER EFFECT] prompting user to select card costing ${cost.treasure}...`);

          const cardIdToGain = (await actionService.run('selectSingleCard', {
            prompt: 'Choose card',
            playerId,
            restrict: {
              all: [{ location: ['basicSupply', 'kingdomSupply'] }, { playerId, kind: 'exact', amount: cost }],
            },
            count: 1,
          })) as number | null;
          if (!cardIdToGain) {
            loggerService.debug('[SWINDLER EFFECT] no replacement card selected');
            continue;
          }

          loggerService.debug(
            `[SWINDLER EFFECT] ${getPlayerById(match, target)} gaining ${cardLibrary.getCard(cardIdToGain)}...`,
          );

          await actionService.run('gainCard', {
            playerId: target,
            cardId: cardIdToGain,
            to: { location: 'playerDiscard' },
          });
        }
      },
  },
  torturer: {
    registerEffects:
      () =>
      async ({ loggerService, reactionContext, actionService, playerId, match, cardLibrary, ...args }) => {
        loggerService.debug(`[TORTURER EFFECT] drawing 3 cards...`);

        await actionService.run('drawCard', { playerId, count: 3 });

        const targets = getAttackTargets(match, playerId, reactionContext);

        loggerService.debug(`[TORTURER EFFECT] targets ${targets.map(id => getPlayerById(match, id)).join(',')}`);

        // Each other player either discards 2 cards or gains a Curse to their hand,
        // their choice. (They may pick an option they can't do.)",
        for (const target of targets) {
          const player = getPlayerById(match, target);
          loggerService.debug(`[TORTURER EFFECT] prompting ${player} to choose to discard or gain curse to hand...`);

          const result = (await actionService.run('userPrompt', {
            playerId: target,
            actionButtons: [
              { action: 1, label: 'DISCARD' },
              { action: 2, label: 'GAIN CURSE' },
            ],
            prompt: 'Choose one',
          })) as { action: number };

          if (result.action === 1) {
            loggerService.debug(`[TORTURER EFFECT] prompting ${player} to discard 2 cards...`);

            const hand = args.cardSourceController.getSource('playerHand', target);

            const cardIds =
              hand.length < 2
                ? hand
                : await actionService.run('selectCard', {
                    prompt: 'Confirm discard',
                    playerId: target,
                    restrict: hand,
                    count: Math.min(2, hand.length),
                  });

            for (const cardId of cardIds) {
              loggerService.debug(`[TORTURER EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);

              await actionService.run('discardCard', {
                cardId,
                playerId: target,
              });
            }

            // Continue to the next target — the attack applies to EVERY other
            // player, not just up to the first one who discards.
            continue;
          }

          const gainedCurseId = await args.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: target,
            pileKey: 'curse',
            from: 'basicSupply',
            to: { location: 'playerHand' },
            logTag: 'torturer effect',
          });

          if (!gainedCurseId) {
            loggerService.debug(`[TORTURER EFFECT] no curse card in supply`);
            continue;
          }
        }
      },
  },
  'trading-post': {
    registerEffects:
      () =>
      async ({ loggerService, actionService, match, cardLibrary, playerId, ...args }) => {
        const count = Math.min(2, args.cardSourceController.getSource('playerHand', playerId).length);

        if (count === 0) {
          loggerService.debug(`[TRADING POST EFFECT] no cards to trash`);
          return;
        }

        loggerService.debug(`[TRADING POST EFFECT] prompting user to trash ${count} cards...`);

        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const cardIds =
          count < 2
            ? hand
            : await actionService.run('selectCard', {
                prompt: 'Confirm trash',
                playerId,
                restrict: hand,
                count,
              });

        for (const cardId of cardIds) {
          loggerService.debug(`[TRADING POST EFFECT] trashing card ${cardLibrary.getCard(cardId)}`);

          await actionService.run('trashCard', {
            playerId,
            cardId,
          });
        }

        if (cardIds.length === 2) {
          const gainedSilverId = await args.supplyGainService.gainTopSupplyCardForPileKey({
            playerId,
            pileKey: 'silver',
            from: 'basicSupply',
            to: { location: 'playerHand' },
            logTag: 'trading post effect',
          });

          if (!gainedSilverId) {
            loggerService.debug(`[TRADING POST EFFECT] no silver in supply`);
          }
        } else {
          loggerService.debug(`[TRADING POST EFFECT] player trashed ${cardIds.length}, so no treasure gained`);
        }
      },
  },
  upgrade: {
    registerEffects:
      () =>
      async ({ loggerService, cardLibrary, actionService, match, playerId, cardPriceController, ...args }) => {
        loggerService.debug(`[UPGRADE EFFECT] drawing card...`);

        await actionService.run('drawCard', { playerId });

        loggerService.debug(`[UPGRADE EFFECT] gaining 1 action...`);

        await actionService.run('gainAction', { count: 1 });

        if (args.cardSourceController.getSource('playerHand', playerId).length === 0) {
          loggerService.debug(`[UPGRADE EFFECT] no cards in hand`);
          return;
        }

        if (args.cardSourceController.getSource('playerHand', playerId).length === 0) {
          loggerService.debug(`[UPGRADE EFFECT] no cards in hand, can't trash`);
          return;
        }

        loggerService.debug(`[UPGRADE EFFECT] prompting user to trash card from hand...`);

        const cardIdToTrash = (await actionService.run('selectSingleCard', {
          prompt: 'Confirm trash',
          playerId,
          restrict: args.cardSourceController.getSource('playerHand', playerId),
          count: 1,
        })) as number | null;
        if (!cardIdToTrash) {
          loggerService.debug('[UPGRADE EFFECT] no card selected to trash');
          return;
        }

        const card = cardLibrary.getCard(cardIdToTrash);

        loggerService.debug(`[UPGRADE EFFECT] trashing ${card}...`);

        await actionService.run('trashCard', {
          playerId,
          cardId: cardIdToTrash,
        });

        const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });

        loggerService.debug(`[UPGRADE EFFECT] prompting user to select card costing ${cardCost.treasure + 2}...`);

        const cardId = (await actionService.run('selectSingleCard', {
          prompt: 'Gain card',
          playerId,
          restrict: {
            all: [
              { location: ['basicSupply', 'kingdomSupply'] },
              { playerId, kind: 'exact', amount: { treasure: cardCost.treasure + 1, potion: cardCost.potion } },
            ],
          },
          count: 1,
        })) as number | null;
        if (!cardId) {
          loggerService.debug('[UPGRADE EFFECT] no gain card selected');
          return;
        }

        loggerService.debug(`[UPGRADE EFFECT] gaining ${cardLibrary.getCard(cardId)} to hand...`);

        await actionService.run('gainCard', {
          playerId,
          cardId,
          to: { location: 'playerDiscard' },
        });
      },
  },
  'wishing-well': {
    registerEffects:
      () =>
      async ({ loggerService, cardLibrary, actionService, playerId }) => {
        loggerService.debug(`[WISHING WELL EFFECT] drawing card...`);

        await actionService.run('drawCard', { playerId });

        loggerService.debug(`[WISHING WELL EFFECT] gaining 1 action...`);

        await actionService.run('gainAction', { count: 1 });

        // Name a card, then reveal the top card of your deck. If you named it, put it into your hand."
        loggerService.debug(`[WISHING WELL EFFECT] prompting user to name a card...`);

        const result = (await actionService.run('userPrompt', {
          playerId,
          content: { type: 'name-card' },
          prompt: 'Name a card',
        })) as { action: number; result: CardKey };

        const cardKey: CardKey = result.result;

        loggerService.debug(`[WISHING WELL EFFECT] player named '${cardKey}'`);

        // Reveal the top card of the deck, shuffling the discard in
        // automatically if the deck is empty.
        const revealed = await revealTopDeckCards({ actionService, cardLibrary, loggerService }, playerId, 1);
        const card = revealed[0];

        if (!card) {
          loggerService.debug(`[WISHING WELL EFFECT] no card to reveal`);
          return;
        }

        if (card.cardKey === cardKey) {
          loggerService.debug(`[WISHING WELL EFFECT] moving ${card} to hand`);

          await actionService.run('moveCard', {
            cardId: card.id,
            toPlayerId: playerId,
            to: { location: 'playerHand' },
          });
        }
      },
  },
};

export default expansionModule;
