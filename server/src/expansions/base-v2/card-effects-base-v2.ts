import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getConfiguredSupplyPileKeys } from '../../utils/get-configured-supply-pile-keys.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { discardDownTo } from '../../utils/discard-down-to.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { Card, CardId } from 'shared/types/index.ts';
import { markPlayerImmune } from '../../utils/reaction-immunity.ts';
import { getAttackTargets } from '../../utils/get-attack-targets.ts';

const expansionModule: CardExpansionModule = {
  // Include the source card id for treasure gains so state effects can adjust values.
  copper: {
    registerEffects:
      () =>
      async ({ actionService, cardId }) => {
        await actionService.run('gainTreasure', { count: 1 }, { source: cardId });
      },
  },
  gold: {
    registerEffects:
      () =>
      async ({ actionService, cardId }) => {
        await actionService.run('gainTreasure', { count: 3 }, { source: cardId });
      },
  },
  silver: {
    registerEffects:
      () =>
      async ({ actionService, cardId }) => {
        await actionService.run('gainTreasure', { count: 2 }, { source: cardId });
      },
  },
  artisan: {
    registerEffects:
      () =>
      async ({ loggerService, cardLibrary, actionService, playerId, ...args }) => {
        loggerService.debug(`[ARTISAN EFFECT] choosing card to gain...`);
        //Gain a card to your hand costing up to 5 Treasure.
        //Put a card from your hand onto your deck.

        let selectedCardId = await actionService.run('selectSingleCard', {
          prompt: 'Choose card to gain',
          playerId: playerId,
          restrict: {
            all: [{ location: ['kingdomSupply', 'basicSupply'] }, { playerId, kind: 'upTo', amount: { treasure: 5 } }],
          },
        });

        if (!selectedCardId) {
          loggerService.debug('[ARTISAN EFFECT] no gain card selected');
          return;
        }

        loggerService.debug(`[ARTISAN EFFECT] card chosen ${cardLibrary.getCard(selectedCardId)}`);

        loggerService.debug(`[ARTISAN EFFECT] gaining card to hand...`);
        await actionService.run('gainCard', {
          playerId,
          cardId: selectedCardId,
          to: {
            location: 'playerHand',
          },
        });

        loggerService.debug(`[ARTISAN EFFECT] choosing card to put on deck...`);

        selectedCardId = await actionService.run('selectSingleCard', {
          prompt: 'Choose card to top-deck',
          playerId: playerId,
          restrict: args.cardSourceController.getSource('playerHand', playerId),
        });

        if (!selectedCardId) {
          loggerService.debug('[ARTISAN EFFECT] no top-deck card selected');
          return;
        }

        loggerService.debug(`[ARTISAN EFFECT] card chosen ${cardLibrary.getCard(selectedCardId)}`);

        loggerService.debug(`[ARTISAN EFFECT] moving card to deck...`);

        await actionService.run('moveCard', {
          toPlayerId: playerId,
          cardId: selectedCardId,
          to: {
            location: 'playerDeck',
          },
        });
      },
  },
  bandit: {
    registerEffects:
      () =>
      async ({ loggerService, match, cardLibrary, playerId, actionService, reactionContext, ...args }) => {
        //Gain a Gold. Each other player reveals the top 2 cards of their deck,
        // trashes a revealed Treasure other than Copper, and discards the rest.

        const goldCardId = args.findCardService
          .findCards({ all: [{ location: 'basicSupply' }, { cardKeys: 'gold' }] })
          ?.slice(-1)?.[0].id;

        if (goldCardId) {
          loggerService.debug(`[BANDIT EFFECT] gaining a gold to discard...`);

          const goldCard = cardLibrary.getCard(goldCardId);

          await actionService.run('gainCard', {
            playerId,
            cardId: goldCard.id,
            to: {
              location: 'playerDiscard',
            },
          });
        } else {
          loggerService.debug(`[BANDIT EFFECT] no gold in supply`);
        }

        const targetPlayerIds = getAttackTargets(match, playerId, reactionContext);

        loggerService.debug(`[BANDIT EFFECT] targets ${targetPlayerIds}`);

        for (const targetPlayerId of targetPlayerIds) {
          const playerDeck = args.cardSourceController.getSource('playerDeck', targetPlayerId);
          const playerDiscard = args.cardSourceController.getSource('playerDiscard', targetPlayerId);

          let numToReveal = 2;
          const totalCards = playerDiscard.length + playerDeck.length;

          numToReveal = Math.min(numToReveal, totalCards);

          if (numToReveal === 0) {
            loggerService.debug(`[BANDIT EFFECT] player has no cards to reveal`);
            continue;
          }

          if (playerDeck.length < numToReveal) {
            loggerService.debug(`[BANDIT EFFECT] not enough cards in deck, shuffling...`);

            await actionService.run('shuffleDeck', {
              playerId: targetPlayerId,
            });
          }

          const cardIdsToReveal = playerDeck.slice(-numToReveal);

          for (const cardId of cardIdsToReveal) {
            loggerService.debug(`[BANDIT EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);

            await actionService.run('revealCard', {
              playerId: targetPlayerId,
              cardId,
              moveToSetAside: true,
            });
          }

          const possibleCardIdsToTrash = cardIdsToReveal.filter(cardId => {
            const card = cardLibrary.getCard(cardId);
            return card.cardKey !== 'copper' && card.type.includes('TREASURE');
          });

          let cardIdTrashed: number;
          if (possibleCardIdsToTrash.length > 0) {
            loggerService.debug(
              `[BANDIT EFFECT] cards that can be trashed ${possibleCardIdsToTrash.map(cardId =>
                cardLibrary.getCard(cardId),
              )}`,
            );

            // they get a choice if there is more than one to trash, and they are different
            const giveChoice =
              possibleCardIdsToTrash.length > 1 &&
              cardLibrary.getCard(possibleCardIdsToTrash[0]).cardKey !==
                cardLibrary.getCard(possibleCardIdsToTrash[1]).cardKey;

            if (giveChoice) {
              loggerService.debug(`[BANDIT EFFECT] prompt user to select card to trash...`);

              const results = await args.promptService.requestResult<CardId[]>({
                playerId: targetPlayerId,
                prompt: 'Choose a treasure to trash',
                content: {
                  type: 'select',
                  cardIds: possibleCardIdsToTrash,
                  selectCount: 1,
                },
              });

              cardIdTrashed = results?.[0] ?? possibleCardIdsToTrash[0];
            } else {
              cardIdTrashed = possibleCardIdsToTrash[0];
              loggerService.debug(
                `[BANDIT EFFECT] not giving player choice, auto trashing ${cardLibrary.getCard(cardIdTrashed)}`,
              );
            }

            loggerService.debug(`[BANDIT EFFECT] player chose ${cardLibrary.getCard(cardIdTrashed)}`);

            loggerService.debug(`[BANDIT EFFECT] trashing card...`);

            await actionService.run('trashCard', {
              playerId: targetPlayerId,
              cardId: cardIdTrashed,
            });
          } else {
            loggerService.debug(`[BANDIT EFFECT] no possible cards to trash`);
          }

          const cardIdsToDiscard = cardIdsToReveal
            .filter(cardId => !possibleCardIdsToTrash.includes(cardId))
            .concat(possibleCardIdsToTrash.filter(id => id !== cardIdTrashed));

          if (cardIdsToDiscard.length > 0) {
            loggerService.debug(
              `[BANDIT EFFECT] cards that will be discarded ${cardIdsToDiscard.map(cardId =>
                cardLibrary.getCard(cardId),
              )}`,
            );

            for (const cardId of cardIdsToDiscard) {
              loggerService.debug(`[BANDIT EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);

              await actionService.run('discardCard', {
                playerId: targetPlayerId,
                cardId,
              });
            }
          } else {
            loggerService.debug(`[BANDIT EFFECT] no cards to discard`);
          }
        }
      },
  },
  bureaucrat: {
    registerEffects:
      () =>
      async ({ loggerService, reactionContext, match, actionService, playerId, ...args }) => {
        // Gain a Silver onto your deck. Each other player reveals a Victory card
        // from their hand and puts it onto their deck (or reveals a hand with no Victory cards).
        const silverCardId = args.findCardService
          .findCards({ all: [{ location: 'basicSupply' }, { cardKeys: 'silver' }] })
          ?.slice(-1)?.[0].id;

        if (!silverCardId) {
          loggerService.debug('[BUREAUCRAT EFFECT] no silver in supply');
        } else {
          loggerService.debug(`[BUREAUCRAT EFFECT] gaining silver to deck...`);

          await actionService.run('gainCard', {
            playerId,
            cardId: silverCardId,
            to: { location: 'playerDeck' },
          });
        }

        const targetPlayerIds = getAttackTargets(match, playerId, reactionContext);

        loggerService.debug(`[BUREAUCRAT EFFECT] targeting ${targetPlayerIds.map(id => getPlayerById(match, id))}`);

        for (const targetPlayerId of targetPlayerIds) {
          const hand = args.findCardService.findCards({ location: 'playerHand', playerId: targetPlayerId });

          const victoryCardsInHand = hand.filter(c => c.type.includes('VICTORY'));

          if (victoryCardsInHand.length === 0) {
            loggerService.debug(
              `[BUREAUCRAT EFFECT] ${getPlayerById(match, targetPlayerId)} has no victory cards, revealing all`,
            );

            for (const card of hand) {
              loggerService.debug(`[BUREAUCRAT EFFECT] revealing ${card}...`);

              await actionService.run('revealCard', {
                playerId: targetPlayerId,
                cardId: card.id,
              });
            }
          } else {
            let cardToReveal: Card;
            const uniqueVictoryCardKeys = new Set(victoryCardsInHand.map(card => card.cardKey));

            if (victoryCardsInHand.length === 1 || uniqueVictoryCardKeys.size === 1) {
              loggerService.debug('[BUREAUCRAT EFFECT] one unique victory option, auto selecting');
              cardToReveal = victoryCardsInHand[0];
            } else {
              loggerService.debug('[BUREAUCRAT EFFECT] prompting user to select victory card to reveal...');
              // Prompt with explicit victory options from hand so the target always gets a visible choice.
              const selectedCardIds = await args.promptService.requestResult<CardId[]>({
                playerId: targetPlayerId,
                prompt: 'Reveal a Victory card',
                content: {
                  type: 'select',
                  cardIds: victoryCardsInHand.map(card => card.id),
                  selectCount: 1,
                },
              });

              const selectedCardId = selectedCardIds?.[0];
              const selectedCard = victoryCardsInHand.find(card => card.id === selectedCardId);
              if (!selectedCard) {
                loggerService.warn('[BUREAUCRAT EFFECT] no valid victory card selected, defaulting to first');
                cardToReveal = victoryCardsInHand[0];
              } else {
                cardToReveal = selectedCard;
              }
            }

            if (!args.findCardService.findCards({
              location: 'playerHand',
              playerId: targetPlayerId,
              cardIds: [cardToReveal.id],
            }).length) {
              loggerService.warn('[BUREAUCRAT EFFECT] selected card left hand before move, skipping target resolution');
              continue;
            }

            loggerService.debug(`[BUREAUCRAT EFFECT] revealing ${cardToReveal}...`);

            await actionService.run('revealCard', {
              playerId: targetPlayerId,
              cardId: cardToReveal.id,
            });

            loggerService.debug('[BUREAUCRAT EFFECT] moving revealed victory card to deck');

            await actionService.run('moveCard', {
              toPlayerId: targetPlayerId,
              cardId: cardToReveal.id,
              to: { location: 'playerDeck' },
            });
          }
        }
      },
  },
  cellar: {
    registerEffects:
      () =>
      async ({ loggerService, match, actionService, playerId, cardLibrary, ...args }) => {
        loggerService.debug(`[CELLAR EFFECT] gaining action...`);
        await actionService.run('gainAction', {
          count: 1,
        });

        const hasCards = args.findCardService.findCards({ location: 'playerHand', playerId }).length > 0;

        if (!hasCards) {
          loggerService.debug('[CELLAR EFFECT] player has no cards to choose from');
          return;
        }

        loggerService.debug(`[CELLAR EFFECT] prompting user to select cards to discard...`);

        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const cardIds = await actionService.run('selectCard', {
          optional: true,
          prompt: 'Confirm discard',
          playerId: playerId,
          count: { kind: 'upTo', count: hand.length },
          restrict: hand,
        });

        loggerService.debug(`[CELLAR EFFECT] user selected ${cardIds.length} cards`);

        if (!cardIds.length) {
          return;
        }

        for (const cardId of cardIds) {
          loggerService.debug(`[CELLAR EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);

          await actionService.run('discardCard', {
            cardId,
            playerId,
          });
        }

        await actionService.run('drawCard', { playerId, count: cardIds.length });
      },
  },
  chapel: {
    registerEffects:
      () =>
      async ({ loggerService, match, actionService, cardLibrary, playerId, ...args }) => {
        const hand = args.cardSourceController.getSource('playerHand', playerId);

        if (!hand.length) {
          loggerService.debug(`[CHAPEL EFFECT] player has no cards in hand`);
          return;
        }

        const cardIds = await actionService.run('selectCard', {
          optional: true,
          prompt: 'Confirm trash',
          playerId,
          count: { kind: 'upTo', count: 4 },
          restrict: args.cardSourceController.getSource('playerHand', playerId),
        });

        if (cardIds?.length === 0) {
          loggerService.debug('[CHAPEL EFFECT] no cards selected');
          return;
        }

        for (const cardId of cardIds) {
          loggerService.debug(`[CELLAR EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

          await actionService.run('trashCard', {
            playerId,
            cardId,
          });
        }
      },
  },
  'council-room': {
    registerEffects:
      () =>
      async ({ loggerService, actionService, match, playerId }) => {
        loggerService.debug(`[COUNCIL ROOM EFFECT] drawing 4 cards...`);
        await actionService.run('drawCard', { playerId, count: 4 });

        loggerService.debug(`[COUNCIL ROOM EFFECT] gaining buy...`);
        await actionService.run('gainBuy', {
          count: 1,
        });

        const playerIds = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match,
        });

        loggerService.debug(`[COUNCIL ROOM EFFECT] targets ${playerIds.map(id => getPlayerById(match, id))}`);

        for (const playerId of playerIds) {
          loggerService.debug(`[COUNCIL EFFECT] ${getPlayerById(match, playerId)} drawing card...`);

          await actionService.run('drawCard', { playerId });
        }
      },
  },
  festival: {
    registerEffects:
      () =>
      async ({ loggerService, actionService }) => {
        loggerService.debug(`[FESTIVAL EFFECT] gaining 2 actions...`);
        await actionService.run('gainAction', {
          count: 2,
        });

        loggerService.debug(`[FESTIVAL EFFECT] gaining 1 buy...`);
        await actionService.run('gainBuy', {
          count: 1,
        });

        loggerService.debug(`[FESTIVAL EFFECT] gaining 2 treasure...`);
        await actionService.run('gainTreasure', {
          count: 2,
        });
      },
  },
  gardens: {
    registerScoringFunction:
      () =>
      ({ match, ownerId, ...args }) => {
        const cards = args.findCardService.findCards({ owner: ownerId });
        return Math.floor(cards.length / 10);
      },
    registerEffects:
      () =>
      async ({ loggerService }) => {
        loggerService.debug(`[GARDENS EFFECT] garden has no effects`);
      },
  },
  harbinger: {
    registerEffects:
      () =>
      async ({ loggerService, cardLibrary, match, actionService, playerId, ...args }) => {
        loggerService.debug(`[HARBINGER EFFECT] drawing card...`);

        await actionService.run('drawCard', { playerId });

        loggerService.debug(`[HARBINGER EFFECT] drawing 1 action...`);
        await actionService.run('gainAction', {
          count: 1,
        });

        if (args.findCardService.findCards({ location: 'playerDiscard', playerId }).length === 0) {
          loggerService.debug('[HARBINGER EFFECT] player has no cards in discard');
          return;
        }

        loggerService.debug(`[HARBINGER EFFECT] prompting user to select card from discard...`);

        const results = await args.promptService.requestActionResult<number[]>({
          playerId,
          prompt: 'Choose card to put on deck?',
          actionButtons: [{ label: 'CANCEL', action: 2 }],
          content: {
            type: 'select',
            cardIds: args.findCardService.findCards({ location: 'playerDiscard', playerId }).map(card => card.id),
            selectCount: 1,
          },
        });

        if (!results || results.action === 2) {
          loggerService.debug('[HARBINGER EFFECT] no card selected');
          return;
        }

        const selectedId = results?.result?.[0];

        if (selectedId) {
          loggerService.debug(`[HARBINGER EFFECT] card selected: ${cardLibrary.getCard(selectedId)}`);

          loggerService.debug(`[HARBINGER EFFECT] moving card to deck...`);

          await actionService.run('moveCard', {
            cardId: selectedId,
            toPlayerId: playerId,
            to: { location: 'playerDeck' },
          });
        } else {
          loggerService.debug('[HARBINGER EFFECT] no card selected');
        }
      },
  },
  laboratory: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, playerId }) => {
        loggerService.debug(`[LABORATORY EFFECT] drawing 2 cards...`);
        await actionService.run('drawCard', { playerId, count: 2 });

        loggerService.debug(`[LABORATORY EFFECT] gaining 1 action...`);
        await actionService.run('gainAction', { count: 1 });
      },
  },
  library: {
    registerEffects:
      () =>
      async ({ loggerService, match, actionService, cardLibrary, playerId, ...args }) => {
        // Draw until you have 7 cards in hand, skipping any Action cards
        // you choose to; set those aside, discarding them afterward.
        const setAside: number[] = [];

        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        const discard = args.cardSourceController.getSource('playerDiscard', playerId);

        loggerService.debug(`[LIBRARY EFFECT] hand size is ${hand.length}`);

        // total hand size should be 7 when done. because i'm drawing to hand and not really
        // placing them in an 'aside' area, the total hand size should be 7 plus the set aside cards.
        // we also make sure the deck+discard length is great enough to be able to draw a card.
        while (hand.length < 7 && deck.length + discard.length > 0) {
          loggerService.debug(`[LIBRARY EFFECT] drawing card...`);

          const drawnCardId = await actionService.run('drawCard', { playerId });

          if (!drawnCardId) {
            loggerService.warn(`[library effect] no card drawn`);
            break;
          }

          const card = cardLibrary.getCard(drawnCardId);

          if (card.type.includes('ACTION')) {
            loggerService.debug(`[LIBRARY EFFECT] ${card} is an action prompting user to set aside...`);

            const setAsideAction = await args.promptService.requestAction({
              playerId,
              prompt: `You drew ${card.cardName}. Set it aside (skip putting it in your hand)?`,
              actionButtons: [
                { label: 'KEEP', action: 1 },
                { label: 'SET ASIDE', action: 2 },
              ],
            });

            if (setAsideAction === 2) {
              loggerService.debug(`[LIBRARY EFFECT] setting card aside`);
              await actionService.run('moveCard', {
                cardId: drawnCardId,
                toPlayerId: playerId,
                to: { location: 'set-aside' },
              });
              setAside.push(drawnCardId);
            } else {
              loggerService.debug('[LIBRARY EFFECT] keeping card in hand');
            }
          } else {
            loggerService.debug(`[LIBRARY EFFECT] card was not an action, keeping in hand`);
          }
        }

        if (setAside.length === 0) {
          loggerService.debug(`[LIBRARY EFFECT] no set aside cards, done`);
          return;
        }

        for (const cardId of setAside) {
          loggerService.debug(`[LIBRARY EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);

          await actionService.run('discardCard', {
            cardId,
            playerId,
          });
        }
      },
  },
  market: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, playerId }) => {
        loggerService.debug(`[MARKET EFFECT] drawing card...`);
        await actionService.run('drawCard', { playerId });

        loggerService.debug(`[MARKET EFFECT] gaining 1 action...`);
        await actionService.run('gainAction', { count: 1 });

        loggerService.debug(`[MARKET EFFECT] gaining 1 buy...`);
        await actionService.run('gainBuy', {
          count: 1,
        });

        loggerService.debug(`[MARKET EFFECT] gaining 1 treasure...`);
        await actionService.run('gainTreasure', {
          count: 1,
        });
      },
  },
  merchant: {
    registerLifeCycleMethods: () => ({
      onCardPlayed: async ({ reactionManager }, { cardId, playerId }) => {
        reactionManager.registerReactionTemplate({
          id: `merchant:${cardId}:cardPlayed`,
          playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'cardPlayed',
          condition: ({ cardLibrary, trigger: silverTrigger, match }) => {
            const silverCard = cardLibrary.getCard(silverTrigger.args.cardId!);
            if (silverCard.cardKey !== 'silver') return false;

            const playedCardInfo = match.stats.playedCards;
            const currentTurnHistoryIndex = match.stats.turns.length - 1;
            const playedSilvers = Object.keys(playedCardInfo).filter(
              cardId =>
                cardLibrary.getCard(+cardId).cardKey === 'silver' &&
                playedCardInfo[+cardId].turnHistoryIndex === currentTurnHistoryIndex &&
                playedCardInfo[+cardId].playerId === silverTrigger.args.playerId,
            );

            return playedSilvers.length === 1;
          },
          triggeredEffectFn: async ({ actionService }) => {
            await actionService.run(
              'gainTreasure',
              {
                count: 1,
              },
              { loggingContext: { source: cardId } },
            );
          },
        });
      },
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`merchant:${cardId}:cardPlayed`);
      },
    }),
    registerEffects:
      () =>
      async ({ loggerService, actionService, playerId }) => {
        loggerService.debug(`[MERCHANT EFFECT] drawing card...`);
        await actionService.run('drawCard', { playerId });

        loggerService.debug(`[MERCHANT EFFECT] gaining 1 action...`);
        await actionService.run('gainAction', { count: 1 });
      },
  },
  militia: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, cardLibrary, match, reactionContext, playerId, ...args }) => {
        loggerService.debug(`[MILITIA EFFECT] gaining 1 treasure...`);
        await actionService.run('gainTreasure', {
          count: 2,
        });

        const playerIds = getAttackTargets(match, playerId, reactionContext);

        loggerService.debug(`[MILITIA EFFECT] targets ${playerIds.map(id => getPlayerById(match, id))}`);

        for (const playerId of playerIds) {
          // Use shared discard helper to avoid duplicating discard-down logic.
          await discardDownTo(
            {
              cardSourceController: args.cardSourceController,
              actionService,
              cardLibrary,
              loggerService,
            },
            {
              playerId,
              targetHandSize: 3,
              prompt: 'Confirm discard',
              logTag: 'MILITIA EFFECT',
            },
          );
        }
      },
  },
  mine: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, match, cardLibrary, playerId, cardPriceController, ...args }) => {
        // You may trash a Treasure from your hand. Gain a Treasure to
        // your hand costing up to 3 Treasure more than it.
        const hand = args.cardSourceController.getSource('playerHand', playerId);

        const hasTreasureCards = hand.some(c => cardLibrary.getCard(c).type.includes('TREASURE'));

        if (!hasTreasureCards) {
          loggerService.debug(`[MINE EFFECT] player has no treasure cards in hand`);
          return;
        }

        loggerService.debug(`[MINE EFFECT] prompting player to trash a treasure`);

        let cardId = await actionService.run('selectSingleCard', {
          optional: true,
          prompt: 'Confirm trash',
          playerId: playerId,
          count: { kind: 'upTo', count: 1 },
          restrict: {
            all: [
              {
                location: 'playerHand',
                playerId,
              },
              { cardType: ['TREASURE'] },
            ],
          },
        });

        if (!cardId) {
          loggerService.debug(`[MINE EFFECT] player selected no card`);
          return;
        }

        loggerService.debug(`[MINE EFFECT] player selected ${cardLibrary.getCard(cardId)}`);

        loggerService.debug(`[MINE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

        await actionService.run('trashCard', {
          playerId,
          cardId,
        });

        let card = cardLibrary.getCard(cardId);

        const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });

        loggerService.debug(`[MINE EFFECT] prompting user to select treasure costing up to ${cardCost.treasure + 3}`);

        cardId = await actionService.run('selectSingleCard', {
          prompt: 'Confirm gain card',
          playerId: playerId,
          count: 1,
          restrict: {
            all: [
              { location: ['kingdomSupply', 'basicSupply'] },
              { cardType: ['TREASURE'] },
              { playerId, kind: 'upTo', amount: { treasure: cardCost.treasure + 3, potion: cardCost.potion } },
            ],
          },
        });

        if (!cardId) {
          loggerService.debug(`[MINE EFFECT] no card selected`);
          return;
        }

        card = cardLibrary.getCard(cardId);

        loggerService.debug(`[MINE EFFECT] player selected ${card}`);

        loggerService.debug(`[MINE EFFECT] gaining card to hand`);

        await actionService.run('gainCard', {
          playerId,
          cardId,
          to: { location: 'playerHand' },
        });
      },
  },
  moat: {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ loggerService, reactionManager }, { playerId, cardId }) => {
        reactionManager.registerReactionTemplate({
          id: `moat:${cardId}:cardPlayed`,
          playerId,
          listeningFor: 'cardPlayed',
          allowMultipleInstances: false,
          condition: ({ cardLibrary, trigger }) => {
            return (
              cardLibrary.getCard(trigger.args.cardId!).type.includes('ATTACK') && trigger.args.playerId !== playerId
            );
          },
          triggeredEffectFn: async function ({ actionService, reaction, reactionContext }) {
            const sourceId = reaction.getSourceId();
            const reactionPlayerId = reaction.playerId;
            if (reactionPlayerId === undefined) {
              loggerService.warn('[MOAT REACTION] missing reaction player id, skipping immunity grant');
              return;
            }

            await actionService.run('revealCard', {
              cardId: sourceId,
              playerId: reactionPlayerId,
            });

            // Record immunity so downstream attacks skip this player.
            loggerService.debug(`[MOAT REACTION] granting immunity to player ${reactionPlayerId}`);
            markPlayerImmune(reactionPlayerId, reactionContext);
          },
        });
      },
      onLeaveHand: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`moat:${cardId}:cardPlayed`);
      },
    }),
    registerEffects:
      () =>
      async ({ actionService, playerId }) => {
        await actionService.run('drawCard', { playerId });
        await actionService.run('drawCard', { playerId });
      },
  },
  moneylender: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, match, cardLibrary, playerId, ...args }) => {
        const hand = args.cardSourceController.getSource('playerHand', playerId);

        const hasCopper = hand.some(c => cardLibrary.getCard(c).cardKey === 'copper');

        if (!hasCopper) {
          loggerService.debug(`[MONEYLENDER EFFECT] player has no copper in hand`);
          return;
        }

        loggerService.debug(`[MONEYLENDER EFFECT] prompting user to trash a copper`);

        const action = await args.promptService.requestAction({
          playerId,
          actionButtons: [
            { action: 1, label: `DON'T TRASH` },
            { action: 2, label: 'TRASH' },
          ],
          prompt: 'Trash a copper?',
        });

        if (action === 1 || action === null) {
          loggerService.debug(`[MONEYLENDER EFFECT] player chose not to trash`);
          return;
        }

        const card = hand.map(cardLibrary.getCard).find(c => c.cardKey === 'copper');

        if (!card) {
          loggerService.warn(`[MONEYLENDER EFFECT] no copper in hand`);
          return;
        }

        loggerService.debug(`[MONEYLENDER EFFECT] trashing ${card}...`);

        await actionService.run('trashCard', {
          playerId,
          cardId: card.id,
        });

        loggerService.debug(`[MONEYLENDER EFFECT] gaining 3 treasure...`);

        await actionService.run('gainTreasure', {
          count: 3,
        });
      },
  },
  poacher: {
    registerEffects:
      () =>
      async ({ loggerService, cardLibrary, match, playerId, actionService, ...args }) => {
        loggerService.debug(`[POACHER EFFECT] drawing card...`);

        await actionService.run('drawCard', { playerId });

        loggerService.debug(`[POACHER EFFECT] gaining 1 action...`);

        await actionService.run('gainAction', { count: 1 });

        loggerService.debug(`[POACHER EFFECT] gaining 1 treasure...`);
        await actionService.run('gainTreasure', { count: 1 });

        const allSupplyCardKeys = getConfiguredSupplyPileKeys(match);

        loggerService.debug(`[POACHER EFFECT] original supply card piles ${allSupplyCardKeys}`);

        const remainingSupplyCardKeys = args.findCardService
          .findCards({ location: ['basicSupply', 'kingdomSupply'] })
          .map(card => card.cardKey)
          .reduce((prev, cardKey) => {
            if (prev.includes(cardKey)) {
              return prev;
            }
            return prev.concat(cardKey);
          }, [] as string[]);

        loggerService.debug(`[POACHER EFFECT] remaining supply card piles ${remainingSupplyCardKeys}`);

        const emptyPileCount = allSupplyCardKeys.length - remainingSupplyCardKeys.length;

        loggerService.debug(`[POACHER EFFECT] number of empty supply piles ${emptyPileCount}`);

        if (emptyPileCount === 0) {
          return;
        }

        const hand = args.cardSourceController.getSource('playerHand', playerId);

        if (hand.length === 0) {
          loggerService.debug(`[POACHER EFFECT] no cards in hand to discard`);
          return;
        }

        let numToDiscard = Math.min(hand.length, emptyPileCount);

        loggerService.debug(`[POACHER EFFECT] number of cards to discard ${numToDiscard}`);

        if (hand.length < emptyPileCount) {
          numToDiscard = Math.min(hand.length, emptyPileCount);
          loggerService.debug(
            `[POACHER EFFECT] not enough cards in hand changing number to discard to ${numToDiscard}`,
          );
        }

        if (numToDiscard === 0) {
          loggerService.debug(`[POACHER EFFECT] no cards to discard`);
          return;
        }

        loggerService.debug(`[POACHER EFFECT] prompting user to discard cards...`);

        const cardIds = await actionService.run('selectCard', {
          prompt: 'Confirm discard',
          playerId: playerId,
          count: numToDiscard,
          restrict: args.cardSourceController.getSource('playerHand', playerId),
        });

        for (const cardId of cardIds) {
          loggerService.debug(`[POACHER EFFECT] discarding card ${cardLibrary.getCard(cardId)}...`);

          await actionService.run('discardCard', {
            playerId,
            cardId,
          });
        }
      },
  },
  remodel: {
    registerEffects:
      () =>
      async ({ loggerService, match, cardLibrary, playerId, actionService, cardPriceController, ...args }) => {
        if (args.cardSourceController.getSource('playerHand', playerId).length === 0) {
          loggerService.debug(`[REMODEL EFFECT] player has no cards in hand`);
          return;
        }

        let cardId = await actionService.run('selectSingleCard', {
          prompt: 'Trash card',
          playerId: playerId,
          count: 1,
          restrict: args.cardSourceController.getSource('playerHand', playerId),
        });

        if (!cardId) {
          loggerService.debug('[REMODEL EFFECT] no card selected to trash');
          return;
        }
        const card = cardLibrary.getCard(cardId);

        loggerService.debug(`[REMODEL EFFECT] trashing card ${card}...`);

        await actionService.run('trashCard', {
          playerId,
          cardId,
        });

        const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });

        loggerService.debug(`[REMODEL EFFECT] prompting user to select card costing up to ${cardCost.treasure}...`);

        cardId = await actionService.run('selectSingleCard', {
          prompt: 'Gain card',
          playerId,
          count: 1,
          restrict: {
            all: [
              { location: ['basicSupply', 'kingdomSupply'] },
              { playerId, kind: 'upTo', amount: { treasure: cardCost.treasure + 2, potion: card.cost.potion } },
            ],
          },
        });
        if (!cardId) {
          loggerService.debug('[REMODEL EFFECT] no gain card selected');
          return;
        }

        loggerService.debug(`[REMODEL EFFECT] gaining ${cardLibrary.getCard(cardId)} to discard...`);

        await actionService.run('gainCard', {
          playerId,
          cardId,
          to: { location: 'playerDiscard' },
        });
      },
  },
  sentry: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, cardLibrary, match, playerId, ...args }) => {
        // +1 Card
        // +1 Action
        // Look at the top 2 cards of your deck. Trash and/or discard any number of
        // them. Put the rest back on top in any order.
        loggerService.debug(`[SENTRY EFFECT] drawing card...`);

        await actionService.run('drawCard', { playerId });

        loggerService.debug(`[SENTRY EFFECT] gaining 1 action...`);

        await actionService.run('gainAction', {
          count: 1,
        });

        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        const discard = args.cardSourceController.getSource('playerDiscard', playerId);

        let numToLookAt = 2;

        loggerService.debug(`[SENTRY EFFECT] number of cards to look at ${numToLookAt}`);

        if (deck.length + discard.length < numToLookAt) {
          numToLookAt = Math.min(2, deck.length + discard.length);
          loggerService.debug(`[SENTRY EFFECT] not enough cards, number of cards to look at is now ${numToLookAt}`);
        }

        if (numToLookAt === 0) {
          loggerService.debug(`[SENTRY EFFECT] player does not have enough cards`);
          return;
        }

        if (deck.length < 2) {
          loggerService.debug(`[SENTRY EFFECT] player has ${deck.length} cards in deck, shuffling deck`);
          await actionService.run('shuffleDeck', {
            playerId,
          });
        }

        const cardsToLookAtIds = deck.slice(-numToLookAt);

        loggerService.debug(`[SENTRY EFFECT] looking at cards ${cardsToLookAtIds.map(id => cardLibrary.getCard(id))}`);

        loggerService.debug(`[SENTRY EFFECT] prompting user to trash cards...`);

        let result = await args.promptService.requestActionResult<number[]>({
          playerId,
          prompt: 'Choose card/s to trash?',
          validationAction: 1,
          actionButtons: [
            { label: `DON'T TRASH`, action: 2 },
            { label: 'TRASH', action: 1 },
          ],
          content: {
            type: 'select',
            cardIds: cardsToLookAtIds,
            selectCount: {
              kind: 'upTo',
              count: cardsToLookAtIds.length,
            },
          },
        });

        const cardIdsToTrash = result?.result ?? [];

        if (result?.action === 1) {
          loggerService.debug(
            `[SENTRY EFFECT] player selected ${cardIdsToTrash.map(id => cardLibrary.getCard(id))} to trash`,
          );

          for (const cardId of cardIdsToTrash) {
            loggerService.debug(`[SENTRY EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);

            await actionService.run('trashCard', {
              playerId,
              cardId: cardId,
            });
          }
        } else {
          loggerService.debug(`[SENTRY EFFECT] player chose not to trash anything`);
        }

        const possibleCardsToDiscard = cardsToLookAtIds.filter(id => !cardIdsToTrash.includes(id));

        if (possibleCardsToDiscard.length === 0) {
          loggerService.debug(`[SENTRY EFFECT] all cards trashed or not more to discard`);
          return;
        }

        result = await args.promptService.requestActionResult<number[]>({
          playerId,
          prompt: 'Choose card/s to discard?',
          validationAction: 1,
          actionButtons: [
            { label: `DON'T DISCARD`, action: 2 },
            { label: 'DISCARD', action: 1 },
          ],
          content: {
            type: 'select',
            cardIds: possibleCardsToDiscard,
            selectCount: {
              kind: 'upTo',
              count: possibleCardsToDiscard.length,
            },
          },
        });

        let cardsToDiscard: number[] = [];
        if (result?.action === 2 || !result) {
          loggerService.debug(`[SENTRY EFFECT] player chose not to discard`);
        } else {
          cardsToDiscard = result?.result ?? [];

          loggerService.debug(
            `[SENTRY EFFECT] player chose ${cardsToDiscard.map(id => cardLibrary.getCard(id))} to discard`,
          );

          for (const selectedCardId of cardsToDiscard) {
            loggerService.debug(`[SENTRY EFFECT] discarding ${cardLibrary.getCard(selectedCardId)}`);

            await actionService.run('discardCard', {
              playerId,
              cardId: selectedCardId,
            });
          }
        }

        const remainingCardIds = cardsToLookAtIds.filter(
          id => !cardIdsToTrash.includes(id) && !cardsToDiscard.includes(id),
        );

        if (remainingCardIds.length <= 1) {
          loggerService.debug(`[SENTRY EFFECT] not enough cards to rearrange`);
          return;
        }

        loggerService.debug(`[SENTRY EFFECT] prompting user to rearrange cards...`);

        result = await args.promptService.requestActionResult<number[]>({
          playerId,
          prompt: 'rearrange cards',
          actionButtons: [{ action: 1, label: 'DONE' }],
          content: {
            type: 'rearrange',
            cardIds: remainingCardIds,
          },
        });

        const cardIds = result?.result ?? [];

        for (const cardId of cardIds) {
          loggerService.debug(`[SENTRY EFFECT] putting ${cardLibrary.getCard(cardId)} on top of deck...`);

          await actionService.run('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: { location: 'playerDeck' },
          });
        }
      },
  },
  smithy: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, playerId }) => {
        loggerService.debug(`[SMITHY EFFECT] drawing 3 cards...`);
        await actionService.run('drawCard', { playerId, count: 3 });
      },
  },
  'throne-room': {
    registerEffects:
      () =>
      async ({ loggerService, playerId, actionService, cardLibrary, ...args }) => {
        loggerService.debug(`[THRONE ROOM EFFECT] prompting user to select action card from hand...`);

        const cardId = await actionService.run('selectSingleCard', {
          optional: true,
          prompt: 'Play an Action card',
          // Throne Room selection immediately plays the chosen Action card.
          selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
          playerId,
          count: { kind: 'upTo', count: 1 },
          restrict: {
            all: [
              {
                location: 'playerHand',
                playerId,
              },
              { cardType: ['ACTION'] },
            ],
          },
        });

        if (!cardId) {
          loggerService.debug(`[THRONE ROOM EFFECT] player chose no cards`);
          return;
        }

        loggerService.debug(`[THRONE ROOM EFFECT] player selected ${cardLibrary.getCard(cardId)}`);

        for (let i = 0; i < 2; i++) {
          loggerService.debug(`[THRONE ROOM EFFECT] running generator...`);

          await actionService.run('playCard', {
            playerId,
            cardId,
            overrides: {
              actionCost: 0,
            },
          });
        }
      },
  },
  vassal: {
    registerEffects:
      () =>
      async ({ loggerService, cardLibrary, match, playerId, actionService, ...args }) => {
        loggerService.debug(`[VASSAL EFFECT] gain 2 treasure...`);

        await actionService.run('gainTreasure', {
          count: 2,
        });

        const playerDeck = args.cardSourceController.getSource('playerDeck', playerId);

        if (playerDeck.length === 0) {
          loggerService.debug(`[VASSAL EFFECT] not enough cards in deck, shuffling`);
          await actionService.run('shuffleDeck', {
            playerId,
          });
        }

        const cardToDiscardId = playerDeck.slice(-1)?.[0];

        if (!cardToDiscardId) {
          loggerService.debug('[VASSAL EFFECT] no cards to discard...');
          return;
        }

        loggerService.debug(`[VASSAL EFFECT] discarding ${cardLibrary.getCard(cardToDiscardId)}...`);

        await actionService.run('discardCard', {
          playerId,
          cardId: cardToDiscardId,
        });

        const card = cardLibrary.getCard(cardToDiscardId);

        if (!card.type.includes('ACTION')) {
          loggerService.debug(`[VASSAL EFFECT] card is not an action, done processing`);
          return;
        }

        loggerService.debug(`[VASSAL EFFECT] prompting user to play card or not...`);

        const confirmAction = await args.promptService.requestAction({
          playerId,
          prompt: `Play card ${card.cardName}?`,
          actionButtons: [
            { label: `DON'T PLAY`, action: 1 },
            { label: 'PLAY', action: 2 },
          ],
        });

        if (confirmAction !== 2) {
          loggerService.debug(`[VASSAL EFFECT] player chose not to play card`);
          return;
        }

        loggerService.debug(`[VASSAL EFFECT] invoking game action generator...`);

        await actionService.run('playCard', {
          playerId,
          cardId: card.id,
          overrides: {
            actionCost: 0,
          },
        });
      },
  },
  village: {
    registerEffects:
      () =>
      async ({ loggerService, playerId, actionService }) => {
        loggerService.debug(`[VILLAGE EFFECT] gaining 2 actions...`);
        await actionService.run('gainAction', { count: 2 });

        loggerService.debug(`[VILLAGE EFFECT] drawing card...`);

        await actionService.run('drawCard', { playerId });
      },
  },
  witch: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, match, playerId, cardLibrary, reactionContext, ...args }) => {
        loggerService.debug(`[WITCH EFFECT] drawing 2 cards...`);

        await actionService.run('drawCard', { playerId, count: 2 });

        const playerIds = getAttackTargets(match, playerId, reactionContext);

        loggerService.debug(`[WITCH EFFECT] targets ${playerIds.map(id => getPlayerById(match, id))}`);

        for (const playerId of playerIds) {
          const curseCards = args.findCardService.findCards({
            all: [{ location: 'basicSupply' }, { cardKeys: 'curse' }],
          });
          if (!curseCards.length) {
            loggerService.debug(`[WITCH EFFECT] no curse cards in supply`);
            return;
          }

          await actionService.run('gainCard', {
            playerId,
            cardId: curseCards.slice(-1)[0].id,
            to: { location: 'playerDiscard' },
          });
        }
      },
  },
  workshop: {
    registerEffects:
      () =>
      async ({ loggerService, actionService, cardLibrary, playerId, ...args }) => {
        loggerService.debug(`[WORKSHOP EFFECT] prompting player to select card to gain...`);

        const cardId = await actionService.run('selectSingleCard', {
          prompt: 'Gain card',
          playerId: playerId,
          count: 1,
          restrict: {
            all: [{ location: ['basicSupply', 'kingdomSupply'] }, { playerId, kind: 'upTo', amount: { treasure: 4 } }],
          },
        });
        if (!cardId) {
          loggerService.debug('[WORKSHOP EFFECT] no gain card selected');
          return;
        }

        loggerService.debug(`[WORKSHOP EFFECT] gaining card ${cardLibrary.getCard(cardId)}`);

        await actionService.run('gainCard', {
          playerId: playerId,
          cardId,
          to: { location: 'playerDiscard' },
        });
      },
  },
};

export default expansionModule;
