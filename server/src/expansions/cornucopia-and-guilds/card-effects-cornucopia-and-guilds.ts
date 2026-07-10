import { Card, CardId, CardKey } from 'shared/types/index.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { getPlayerStartingFrom } from '@shared/get-player-position-utils.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { getAttackTargets } from '../../utils/get-attack-targets.ts';

const expansion: CardExpansionModule = {
  advisor: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[advisor effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const cardsRevealed: Card[] = [];

      loggerService.debug(`[advisor effect] revealing 3 cards`);

      for (let i = 0; i < 3; i++) {
        if (deck.length === 0) {
          loggerService.debug(`[advisor effect] no cards in deck, shuffling`);
          await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });

          if (deck.length === 0) {
            loggerService.debug(`[advisor effect] no cards in deck after shuffling`);
            break;
          }
        }

        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        cardsRevealed.push(card);
        await cardEffectArgs.actionService.run('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true,
        });
      }

      const leftPlayer = getPlayerStartingFrom({
        startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
        match: cardEffectArgs.match,
        distance: 1,
      });

      loggerService.debug(`[advisor effect] player ${leftPlayer} choosing card to discard`);

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: `Choose one for ${getPlayerById(cardEffectArgs.match, cardEffectArgs.playerId)?.name} to discard`,
        playerId: leftPlayer.id,
        content: {
          type: 'select',
          cardIds: cardsRevealed.map(card => card.id),
          selectCount: 1,
        },
      })) as { action: number; result: number[] };

      const cardId = result.result[0];

      if (!cardId) {
        loggerService.warn(`[advisor effect] no card selected`);
      } else {
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        loggerService.debug(`[advisor effect] player ${cardEffectArgs.playerId} discarding ${card}`);
        await cardEffectArgs.actionService.run('discardCard', { cardId, playerId: cardEffectArgs.playerId });
      }

      const toMoveToHand = cardsRevealed.filter(card => card.id !== cardId);

      loggerService.debug(`[advisor effect] moving ${toMoveToHand.length} cards to hand`);

      for (const card of toMoveToHand) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: card.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHand' },
        });
      }
    },
  },
  baker: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainCoffer', { playerId: cardEffectArgs.playerId, count: 1 });
    },
  },
  butcher: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[butcher effect] gaining 2 coffers`);
      await cardEffectArgs.actionService.run('gainCoffer', { playerId: cardEffectArgs.playerId, count: 2 });

      let selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card?`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[butcher effect] no card selected`);
        return;
      }

      let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId,
      });

      const cards = cardEffectArgs.findCardService.findCards({
        all: [
          { location: ['basicSupply', 'kingdomSupply'] },
          {
            kind: 'upTo',
            playerId: cardEffectArgs.playerId,
            amount: {
              treasure: cost.treasure + (cardEffectArgs.match.coffers[cardEffectArgs.playerId] ?? 0),
              potion: cost.potion,
            },
          },
        ],
      });

      if (!cards) {
        loggerService.debug(`[butcher effect] no cards in supply that match cost`);
        return;
      }

      selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cards.map(card => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[butcher effect] no card selected`);
        return;
      }

      selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      const { cost: selectedCardCost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId,
      });

      loggerService.debug(`[butcher effect] gaining ${selectedCard}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' },
      });

      if (selectedCardCost.treasure - cost.treasure > 0) {
        loggerService.debug(`[butcher effect] spending ${selectedCardCost.treasure - cost.treasure} coffers`);
        await cardEffectArgs.actionService.run('gainCoffer', {
          playerId: cardEffectArgs.playerId,
          count: -(selectedCardCost.treasure - cost.treasure),
        });
      }
    },
  },
  'candlestick-maker': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[candlestick maker effect] gaining 1 action, 1 buy, and 1 coffer`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainCoffer', { playerId: cardEffectArgs.playerId, count: 1 });
    },
  },
  carnival: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const cardsToKeep: Card[] = [];
      const cardsToDiscard: Card[] = [];

      for (let i = 0; i < 4; i++) {
        if (deck.length === 0) {
          loggerService.debug(`[carnival effect] no cards in deck, shuffling`);
          await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });

          if (deck.length === 0) {
            loggerService.debug(`[carnival effect] no cards in deck after shuffling`);
            break;
          }
        }

        const revealedCardId = deck.slice(-1)[0];
        const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);

        loggerService.debug(`[carnival effect] revealing ${revealedCard}`);

        await cardEffectArgs.actionService.run('revealCard', {
          cardId: revealedCardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true,
        });

        if (!cardsToKeep.find(card => card.cardKey === revealedCard.cardKey)) {
          loggerService.debug(`[carnival effect] adding ${revealedCard} to keep`);
          cardsToKeep.push(revealedCard);
        } else {
          loggerService.debug(`[carnival effect] adding ${revealedCard} to discard`);
          cardsToDiscard.push(revealedCard);
        }
      }

      loggerService.debug(`[carnival effect] discarding ${cardsToDiscard.length} cards`);

      for (const card of cardsToDiscard) {
        await cardEffectArgs.actionService.run('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
        });
      }

      loggerService.debug(`[carnival effect] moving ${cardsToKeep.length} cards to hand`);

      for (const card of cardsToKeep) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: card.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHand' },
        });
      }
    },
  },
  coronet: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const handCards = cardEffectArgs.findCardService.findCards({
        location: 'playerHand',
        playerId: cardEffectArgs.playerId,
      });

      const cardSources = [
        handCards.filter(card => !card.type.includes('REWARD') && card.type.includes('ACTION')),
        handCards.filter(card => !card.type.includes('REWARD') && card.type.includes('TREASURE')),
      ];

      for (let i = 0; i < 2; i++) {
        loggerService.debug(
          `[coronet effect] processing ${
            i === 0 ? 'non-reward action instruction' : 'non-reward treasure instruction'
          }`,
        );
        const cardSource = cardSources[i];

        if (cardSource.length === 0) {
          loggerService.debug(`[coronet effect] no non-reward action cards in hand`);
          return;
        }

        const uniqueCardNames = Array.from(new Set(cardSource.map(card => card.cardName)));

        let selectedCardId: CardId | undefined = undefined;

        if (uniqueCardNames.length === 1) {
          loggerService.debug(`[coronet effect] only one unique card in hand, prompting to play`);

          const result = (await cardEffectArgs.actionService.run('userPrompt', {
            prompt: `Play ${uniqueCardNames[0]}?`,
            playerId: cardEffectArgs.playerId,
            actionButtons: [
              { label: 'CANCEL', action: 1 },
              { label: 'PLAY', action: 2 },
            ],
          })) as { action: number; result: number[] };

          if (result.action === 2) {
            selectedCardId = cardSource[0].id;
          }
        } else {
          loggerService.debug(`[coronet effect] multiple unique cards in hand, prompting to select`);
          const selectedId = await cardEffectArgs.actionService.run('selectSingleCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Play non-Reward ${i === 0 ? 'Action' : 'Treasure'}?`,
            restrict: cardSource.map(card => card.id),
            count: 1,
            optional: true,
          });

          if (selectedId) {
            selectedCardId = selectedId;
          }
        }

        if (!selectedCardId) {
          loggerService.debug(`[coronet effect] no card selected`);
          return;
        }

        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[coronet effect] playing ${selectedCard} twice`);

        for (let i = 0; i < 2; i++) {
          await cardEffectArgs.actionService.run('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
            overrides: {
              actionCost: 0,
            },
          });
        }
      }
    },
  },
  courser: {
    registerEffects: () => async cardEffectArgs => {
      const actions = [
        { label: '+2 Cards', action: 1 },
        { label: '+2 Actions', action: 2 },
        { label: '+2 Treasure', action: 3 },
        { label: 'Gain 4 Silvers', action: 4 },
      ];

      for (let i = 0; i < 2; i++) {
        const result = (await cardEffectArgs.actionService.run('userPrompt', {
          prompt: 'Choose one',
          playerId: cardEffectArgs.playerId,
          actionButtons: actions,
        })) as { action: number; result: number[] };

        const idx = actions.findIndex(action => action.action === result.action);
        if (idx !== -1) {
          actions.splice(idx, 1);
        }

        switch (result.action) {
          case 1:
            await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
            break;
          case 2:
            await cardEffectArgs.actionService.run('gainAction', { count: 2 });
            break;
          case 3:
            await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
            break;
          case 4: {
            const silverCardIds = cardEffectArgs.findCardService.findCards({
              all: [{ location: 'basicSupply' }, { cardKeys: 'silver' }],
            });

            const numToGain = Math.min(4, silverCardIds.length);
            for (let i = 0; i < numToGain; i++) {
              await cardEffectArgs.actionService.run('gainCard', {
                playerId: cardEffectArgs.playerId,
                cardId: silverCardIds.slice(-(i + 1))[0].id,
                to: { location: 'playerDiscard' },
              });
            }

            break;
          }
        }
      }
    },
  },
  demesne: {
    registerScoringFunction: () => args => {
      const ownedGoldCards = args.findCardService
        .findCards({ all: [{ owner: args.ownerId }] })
        .filter(card => card.cardKey === 'gold');
      return ownedGoldCards.length;
    },
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[demesne effect] gaining 2 actions, and 2 buys`);
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 2 });

      const goldCardIds = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'basicSupply' }, { cardKeys: 'gold' }],
      });

      if (!goldCardIds.length) {
        loggerService.debug(`[demesne effect] no gold cards in supply`);
        return;
      }

      const goldCard = cardEffectArgs.cardLibrary.getCard(goldCardIds.slice(-1)[0].id);

      loggerService.debug(`[demesne effect] gaining ${goldCard}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: goldCard.id,
        to: { location: 'playerDiscard' },
      });
    },
  },
  fairgrounds: {
    registerScoringFunction: () => args => {
      const cards = args.cardLibrary.getAllCardsAsArray().filter(card => card.owner === args.ownerId);
      const uniqueNameCardCount = new Set(cards.map(card => card.cardName)).size;
      const score = Math.floor(uniqueNameCardCount / 5);
      return score;
    },
  },
  farmhands: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', eventArgs.playerId);
        const actionTreasureCards = hand
          .map(cardEffectArgs.cardLibrary.getCard)
          .filter(card => card.type.includes('ACTION') || card.type.includes('TREASURE'));

        if (actionTreasureCards.length === 0) {
          loggerService.debug(`[farmhands effect] no action or treasure cards in hand, not prompting to select`);
          return;
        }

        const result = await cardEffectArgs.actionService.run('selectSingleCard', {
          prompt: 'Set aside?',
          playerId: eventArgs.playerId,
          optional: true,
          count: 1,
          restrict: {
            all: [{ location: 'playerHand', playerId: eventArgs.playerId }, { cardType: ['ACTION', 'TREASURE'] }],
          },
        });

        if (result) {
          const cardId = result;
          await cardEffectArgs.actionService.run('moveCard', {
            cardId,
            toPlayerId: eventArgs.playerId,
            to: { location: 'set-aside' },
          });

          cardEffectArgs.reactionManager.registerReactionTemplate({
            id: `farmhands:${cardEffectArgs.cardLibrary}:startTurn`,
            listeningFor: 'startTurn',
            condition: conditionArgs => {
              if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
              return true;
            },
            once: true,
            compulsory: true,
            allowMultipleInstances: true,
            playerId: eventArgs.playerId,
            triggeredEffectFn: async triggerEffectArgs => {
              await triggerEffectArgs.actionService.run('playCard', {
                playerId: eventArgs.playerId,
                cardId,
                overrides: {
                  actionCost: 0,
                },
              });
            },
          });
        } else {
          loggerService.debug(`[farmhands effect] player chose not to set aside`);
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[farmhands effect] drawing 1 card, and 2 actions`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
    },
  },
  farrier: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
        const overpaid = boughtStats.paid - boughtStats.cost;

        if (!eventArgs.bought || overpaid <= 0) {
          return;
        }

        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `farrier:${eventArgs.cardId}:endTurn`,
          listeningFor: 'endTurn',
          playerId: eventArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: () => true,
          triggeredEffectFn: async triggerEffectArgs => {
            await triggerEffectArgs.actionService.run(
              'drawCard',
              {
                playerId: eventArgs.playerId,
                count: overpaid,
              },
              { loggingContext: { source: eventArgs.cardId } },
            );
          },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[farrier effect] drawing 1 card, gaining 1 action, and 1 buy`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `farrier:${cardEffectArgs.cardId}:endTurn`,
        listeningFor: 'endTurn',
        playerId: cardEffectArgs.playerId,
        allowMultipleInstances: true,
        once: true,
        compulsory: true,
        condition: conditionArgs => true,
        triggeredEffectFn: async triggerEffectArgs => {},
      });
    },
  },
  ferryman: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        const cardIds = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'kingdomSupply' }, { tags: 'ferryman' }],
        });

        if (!cardIds.length) {
          loggerService.debug(`[ferryman effect] no ferryman cards in kingdom, can't gain`);
          return;
        }

        await cardEffectArgs.actionService.run(
          'gainCard',
          {
            playerId: eventArgs.playerId,
            cardId: cardIds.slice(-1)[0].id,
            to: { location: 'playerDiscard' },
          },
          { loggingContext: { source: eventArgs.cardId } },
        );
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[ferryman effect] drawing 2 cards, and 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard card`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[ferryman effect] no cards selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[ferryman effect] discarding ${selectedCard}`);

      await cardEffectArgs.actionService.run('discardCard', {
        cardId: selectedCardId,
        playerId: cardEffectArgs.playerId,
      });
    },
  },
  footpad: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[footpad effect] gaining 2 coffers`);
      await cardEffectArgs.actionService.run('gainCoffer', { playerId: cardEffectArgs.playerId, count: 2 });

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        const numToDiscard = hand.length - 3;
        if (numToDiscard <= 0) {
          loggerService.debug(`[footpad effect] player ${targetPlayerId} already at 3 or less`);
          continue;
        }

        loggerService.debug(`[footpad effect] player ${targetPlayerId} discarding ${numToDiscard} cards`);

        const selectedCardId = await cardEffectArgs.actionService.run('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard cards`,
          restrict: hand,
          count: numToDiscard,
        });

        if (!selectedCardId.length) {
          loggerService.warn(`[footpad effect] no cards selected`);
          continue;
        }

        loggerService.debug(`[footpad effect] player ${targetPlayerId} discarding ${selectedCardId.length} cards`);

        for (let i = 0; i < selectedCardId.length; i++) {
          const cardId = selectedCardId[i];
          await cardEffectArgs.actionService.run('discardCard', {
            cardId: cardId,
            playerId: targetPlayerId,
          });
        }
      }
    },
  },
  hamlet: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[hamlet effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      if (hand.length > 0) {
        const result = await cardEffectArgs.actionService.run('selectSingleCard', {
          prompt: 'Discard to gain action?',
          playerId: cardEffectArgs.playerId,
          optional: true,
          count: 1,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        });

        if (result) {
          loggerService.debug(`[hamlet effect] player chose to discard to gain +1 action`);
          const cardId = result;
          await cardEffectArgs.actionService.run('discardCard', { cardId, playerId: cardEffectArgs.playerId });
          await cardEffectArgs.actionService.run('gainAction', { count: 1 });
        } else {
          loggerService.debug(`[hamlet effect] player chose not to discard to gain +1 action`);
        }
      } else {
        loggerService.debug(`[hamlet effect] no cards in hand, not prompting to discard for action`);
      }

      if (hand.length > 0) {
        const result = await cardEffectArgs.actionService.run('selectSingleCard', {
          prompt: 'Discard to gain buy?',
          playerId: cardEffectArgs.playerId,
          optional: true,
          count: 1,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        });

        if (result) {
          const cardId = result;
          await cardEffectArgs.actionService.run('discardCard', { cardId, playerId: cardEffectArgs.playerId });
          await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
        } else {
          loggerService.debug(`[hamlet effect] player chose not to discard to gain +1 buy`);
        }
      } else {
        loggerService.debug(`[hamlet effect] no cards in hand, not prompting to discard for buy`);
      }
    },
  },
  herald: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `herald:${eventArgs.cardId}:endTurn`,
          playerId: eventArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'endTurn',
          condition: () => true,
          triggeredEffectFn: async triggerEffectArgs => {
            const boughtStats = triggerEffectArgs.match.stats.cardsBought[eventArgs.cardId];
            const overpaid = boughtStats.paid - boughtStats.cost;
            if (!eventArgs.bought || overpaid <= 0) {
              loggerService.debug(`[herald triggered effect] no overpay cost spent for ${eventArgs.cardId}`);
              return;
            }

            loggerService.debug(`[herald triggered effect] ${eventArgs.playerId} overpaid for ${eventArgs.cardId}`);

            const discardIds = triggerEffectArgs.findCardService
              .findCards({
                location: 'playerDiscard',
                playerId: eventArgs.playerId,
              })
              .map(card => card.id);

            const numToChoose = Math.min(overpaid, discardIds.length);

            if (!numToChoose) {
              loggerService.debug(`[herald onGained effect] no cards in discard`);
              return;
            }

            const result = (await triggerEffectArgs.actionService.run('userPrompt', {
              prompt: `You may choose up to ${numToChoose} from your discard to top-deck`,
              playerId: eventArgs.playerId,
              actionButtons: [{ label: 'DONE', action: 1 }],
              content: {
                type: 'select',
                cardIds: discardIds,
                selectCount: {
                  kind: 'upTo',
                  count: numToChoose,
                },
              },
              validationAction: 1,
            })) as { action: number; result: CardId[] };

            loggerService.debug(`[herald triggered effect] putting ${result.result.length} cards on top of deck`);

            for (const cardId of result.result) {
              await cardEffectArgs.actionService.run('moveCard', {
                cardId: cardId,
                toPlayerId: eventArgs.playerId,
                to: { location: 'playerDeck' },
              });
            }
          },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[herald effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);

      if (deck.length === 0) {
        loggerService.debug(`[herald effect] no cards in deck, shuffling`);
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });

        if (deck.length === 0) {
          loggerService.debug(`[herald effect] no cards in deck after shuffling`);
          return;
        }
      }

      const cardId = deck.slice(-1)[0];
      const card = cardEffectArgs.cardLibrary.getCard(cardId);

      loggerService.debug(`[herald effect] player ${cardEffectArgs.playerId} revealing ${card}`);

      await cardEffectArgs.actionService.run('revealCard', {
        cardId,
        playerId: cardEffectArgs.playerId,
      });

      if (card.type.includes('ACTION')) {
        loggerService.debug(`[herald effect] card is an action card, playing it`);
        await cardEffectArgs.actionService.run('playCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
        });
      }
    },
  },
  'horn-of-plenty': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const uniquelyNamesCardsInPlay = new Set(
        cardEffectArgs.findCardService
          .getCardsInPlay()
          .filter(card => card.owner === cardEffectArgs.playerId)
          .map(card => card.cardName),
      ).size;

      const cards = cardEffectArgs.findCardService.findCards({
        all: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: uniquelyNamesCardsInPlay } },
        ],
      });

      if (!cards.length) {
        loggerService.debug(`[horn of plenty effect] no cards in supply costing up to ${uniquelyNamesCardsInPlay}`);
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cards.map(card => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[horn of plenty effect] no cards selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[horn of plenty effect] gaining ${selectedCard}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' },
      });

      if (selectedCard.type.includes('VICTORY')) {
        loggerService.debug(`[horn of plenty effect] card is a victory card, trashing horn of plenty`);
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cardEffectArgs.cardId,
        });
      }
    },
  },
  housecarl: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const uniqueActionCardsInPlay = Array.from(
        cardEffectArgs.findCardService
          .getCardsInPlay()
          .filter(card => card.type.includes('ACTION'))
          .reduce((map, card) => {
            if (!map.has(card.cardKey)) {
              map.set(card.cardKey, card);
            }
            return map;
          }, new Map<Card['cardKey'], Card>())
          .values(),
      );

      if (uniqueActionCardsInPlay.length === 0) {
        loggerService.debug(`[housecarl effect] no action cards in play`);
        return;
      }

      loggerService.debug(`[housecarl effect] drawing ${uniqueActionCardsInPlay.length} cards`);

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: uniqueActionCardsInPlay.length,
      });
    },
  },
  'huge-turnip': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      await cardEffectArgs.actionService.run('gainCoffer', { count: 2, playerId: cardEffectArgs.playerId });

      const coffers = cardEffectArgs.match.coffers?.[cardEffectArgs.playerId] ?? 0;

      if (coffers === 0) {
        loggerService.debug(`[huge turnip effect] no coffers`);
        return;
      }

      loggerService.debug(`[huge turnip effect] gaining ${coffers} treasure`);

      await cardEffectArgs.actionService.run('gainTreasure', { count: coffers });
    },
  },
  'hunting-party': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[hunting party effect] drawing 1 card and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      if (hand.length === 0) {
        loggerService.warn(`[hunting party effect] no cards in hand`);
        return;
      }

      loggerService.debug(`[hunting party effect] revealing ${hand.length} cards`);

      for (const cardId of hand) {
        await cardEffectArgs.actionService.run('revealCard', {
          cardId: cardId,
          playerId: cardEffectArgs.playerId,
        });
      }

      const uniqueHandCardNames = new Set(hand.map(cardEffectArgs.cardLibrary.getCard).map(card => card.cardName));

      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);

      const cardsToDiscard: CardId[] = [];

      while (deck.length + discard.length > 0) {
        let cardId = deck.slice(-1)[0];

        if (!cardId) {
          await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });

          cardId = deck.slice(-1)[0];

          if (!cardId) {
            loggerService.warn(`[hunting party effect] no cards in deck after shuffling`);
            return;
          }
        }

        const card = cardEffectArgs.cardLibrary.getCard(cardId);

        loggerService.debug(`[hunting party effect] revealing ${card}`);

        await cardEffectArgs.actionService.run('revealCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true,
        });

        if (uniqueHandCardNames.has(card.cardName)) {
          loggerService.debug(`[hunting party effect] adding ${card.cardName} to discards`);
          cardsToDiscard.push(cardId);
        } else {
          loggerService.debug(`[hunting party effect] moving ${card.cardName} to hand`);
          await cardEffectArgs.actionService.run('moveCard', {
            cardId: cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' },
          });
          break;
        }
      }

      loggerService.debug(`[hunting party effect] discarding ${cardsToDiscard.length} cards`);
      for (const cardId of cardsToDiscard) {
        await cardEffectArgs.actionService.run('discardCard', {
          cardId: cardId,
          playerId: cardEffectArgs.playerId,
        });
      }
    },
  },
  infirmary: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
        const overpaid = boughtStats.paid - boughtStats.cost;
        if (!eventArgs.bought || overpaid <= 0) {
          loggerService.debug(`[infirmary onGained] no overpay cost spent for ${eventArgs.cardId}`);
          return;
        }

        loggerService.debug(`[infirmary onGained] ${eventArgs.playerId} overpaid for ${eventArgs.cardId}`);

        for (let i = 0; i < overpaid; i++) {
          await cardEffectArgs.actionService.run('playCard', {
            playerId: eventArgs.playerId,
            cardId: eventArgs.cardId,
          });
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[infirmary effect] drawing 1 card`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[infirmary effect] no cards selected`);
        return;
      }

      const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[infirmary effect] player ${cardEffectArgs.playerId} trashing ${card}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });
    },
  },
  jester: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[jester effect] gaining 2 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);

        if (deck.length === 0) {
          loggerService.debug(`[jester effect] no cards in deck, shuffling`);
          await cardEffectArgs.actionService.run('shuffleDeck', { playerId: targetPlayerId });

          if (deck.length === 0) {
            loggerService.debug(`[jester effect] no cards in deck after shuffling`);
            continue;
          }
        }

        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);

        loggerService.debug(`[jester effect] player ${targetPlayerId} discarding ${card}`);
        await cardEffectArgs.actionService.run('discardCard', { cardId: cardId, playerId: targetPlayerId });

        if (card.type.includes('VICTORY')) {
          loggerService.debug(`[jester effect] card is a victory card, gaining curse`);
          const curseCardIds = cardEffectArgs.findCardService.findCards({
            all: [{ location: 'basicSupply' }, { cardKeys: 'curse' }],
          });

          if (!curseCardIds.length) {
            loggerService.debug(`[jester effect] no curse cards in supply`);
            continue;
          }

          await cardEffectArgs.actionService.run('gainCard', {
            playerId: targetPlayerId,
            cardId: curseCardIds.slice(-1)[0].id,
            to: { location: 'basicSupply' },
          });
        } else {
          const copyIds = cardEffectArgs.findCardService.findCards({
            all: [{ location: ['basicSupply', 'kingdomSupply'] }, { cardKeys: card.cardKey }],
          });

          if (!copyIds.length) {
            loggerService.debug(`[jester effect] no copies of ${card.cardName} in supply`);
            continue;
          }

          const result = (await cardEffectArgs.actionService.run('userPrompt', {
            prompt: `You or they gain a ${card.cardName}`,
            playerId: cardEffectArgs.playerId,
            actionButtons: [
              { label: 'THEY GAIN', action: 1 },
              { label: 'YOU GAIN', action: 2 },
            ],
          })) as { action: number; result: number[] };

          const copyId = copyIds.slice(-1)[0];

          if (result.action === 1) {
            loggerService.debug(`[jester effect] player ${targetPlayerId} gaining ${card.cardName}`);
            await cardEffectArgs.actionService.run('gainCard', {
              playerId: targetPlayerId,
              cardId: copyId.id,
              to: { location: 'playerDiscard' },
            });
          } else {
            loggerService.debug(`[jester effect] player ${cardEffectArgs.playerId} gaining ${card.cardName}`);
            await cardEffectArgs.actionService.run('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: copyId.id,
              to: { location: 'playerDiscard' },
            });
          }
        }
      }
    },
  },
  journeyman: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Name a card',
        playerId: cardEffectArgs.playerId,
        content: { type: 'name-card' },
      })) as { action: number; result: CardKey };

      const key = result.result;

      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      let count = 0;
      while (deck.length + discard.length > 0 && count < 3) {
        if (deck.length === 0) {
          loggerService.warn(`[journeyman effect] no cards in deck, shuffling`);
          await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });

          if (deck.length === 0) {
            loggerService.warn(`[journeyman effect] no cards in deck after shuffling`);
            break;
          }
        }

        const cardId = deck.slice(-1)[0];
        await cardEffectArgs.actionService.run('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true,
        });
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        if (card.cardKey === key) {
          await cardEffectArgs.actionService.run('discardCard', { cardId, playerId: cardEffectArgs.playerId });
        } else {
          await cardEffectArgs.actionService.run('moveCard', {
            cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' },
          });
          count++;
        }
      }
    },
  },
  joust: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[joust effect] drawing 1 card, and gaining 1 action, and 1 treasure`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const provinceCardsInHand = cardEffectArgs.findCardService
        .findCards({
          location: 'playerHand',
          playerId: cardEffectArgs.playerId,
        })
        .filter(card => card.cardKey === 'province');

      if (provinceCardsInHand.length === 0) {
        loggerService.debug(`[joust effect] no province cards in hand`);
        return;
      }

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Set aside province?',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'CANCEL', action: 1 },
          { label: 'SET ASIDE', action: 2 },
        ],
      })) as { action: number; result: number[] };

      if (result.action === 1) {
        loggerService.debug(`[joust effect] player ${cardEffectArgs.playerId} cancelling joust`);
        return;
      }

      const provinceCard = provinceCardsInHand.slice(-1)[0];

      loggerService.debug(`[joust effect] player ${cardEffectArgs.playerId} setting aside ${provinceCard}`);

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: provinceCard.id,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'set-aside' },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `joust:${cardEffectArgs.cardId}:startPhase`,
        listeningFor: 'startTurnPhase',
        condition: conditionArgs => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'cleanup') return false;
          return true;
        },
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        triggeredEffectFn: async () => {
          loggerService.debug(
            `[joust triggered effect] player ${cardEffectArgs.playerId} discarding set aside ${provinceCard}`,
          );
          await cardEffectArgs.actionService.run('discardCard', {
            cardId: provinceCard.id,
            playerId: cardEffectArgs.playerId,
          });
        },
      });

      const rewardCardIds = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'nonSupplyCards' }, { cardType: 'REWARD' }],
      });

      if (!rewardCardIds.length) {
        loggerService.debug(`[joust effect] no reward cards in supply`);
        return;
      }

      let selectedRewardId: CardId | undefined = undefined;

      if (rewardCardIds.length === 1) {
        selectedRewardId = rewardCardIds[0].id;
      } else {
        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Select reward`,
          restrict: rewardCardIds.map(card => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          return;
        }
        selectedRewardId = selectedCardId;
      }

      if (!selectedRewardId) {
        loggerService.warn(`[joust effect] no reward card selected`);
        return;
      }

      const selectedRewardCard = cardEffectArgs.cardLibrary.getCard(selectedRewardId);

      loggerService.debug(`[joust effect] player ${cardEffectArgs.playerId} gaining ${selectedRewardCard}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedRewardId,
        to: { location: 'playerHand' },
      });
    },
  },
  menagerie: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[menagerie effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      loggerService.debug(`[menagerie effect] revealing ${hand.length} cards`);

      for (const cardId of hand) {
        await cardEffectArgs.actionService.run('revealCard', {
          cardId: cardId,
          playerId: cardEffectArgs.playerId,
        });
      }

      const uniqueHandCardNames = new Set(hand.map(cardEffectArgs.cardLibrary.getCard).map(card => card.cardName));

      if (uniqueHandCardNames.size === hand.length) {
        loggerService.debug(`[menagerie effect] all cards in hand are unique, gaining 3 cards`);
        await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });
      } else {
        loggerService.debug(`[menagerie effect] not all cards in hand are unique, gaining 1 card`);
        await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      }
    },
  },
  'merchant-guild': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[merchant guild effect] gaining 1 buy, and 1 treasure`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `merchant-guild:${cardEffectArgs.cardId}:endTurnPhase`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'endTurnPhase',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: conditionArgs => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;
          return true;
        },
        triggeredEffectFn: async triggerEffectArgs => {
          const stats = triggerEffectArgs.match.stats;
          const turnHistoryIndex = triggerEffectArgs.match.stats.turns.length - 1;
          const turnStatsIndex = turnHistoryIndex;

          const cardIdsGainedThisTurn = stats.cardsGainedByTurn[turnStatsIndex];
          const selfGainedCardIdsThisTurn =
            cardIdsGainedThisTurn?.filter(cardId => stats.cardsGained[cardId].playerId === cardEffectArgs.playerId) ??
            [];

          if (!selfGainedCardIdsThisTurn.length) {
            loggerService.debug(`[merchant guild triggered effect] no cards gained this buy phase`);
            return;
          }

          loggerService.debug(`[merchant guild triggered effect] gaining ${selfGainedCardIdsThisTurn.length} coffers`);

          await cardEffectArgs.actionService.run(
            'gainCoffer',
            {
              playerId: cardEffectArgs.playerId,
              count: selfGainedCardIdsThisTurn.length,
            },
            { loggingContext: { source: cardEffectArgs.cardId } },
          );
        },
      });
    },
  },
  plaza: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[plaza effect] drawing 1 card, and gaining 2 actions`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard treasure`,
        restrict: { all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }, { cardType: 'TREASURE' }] },
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[plaza effect] no cards selected`);
        return;
      }

      const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      loggerService.debug(`[plaza effect] player ${cardEffectArgs.playerId} discarding ${card}`);

      await cardEffectArgs.actionService.run('discardCard', {
        cardId: selectedCardId,
        playerId: cardEffectArgs.playerId,
      });

      await cardEffectArgs.actionService.run('gainCoffer', { playerId: cardEffectArgs.playerId, count: 1 });
    },
  },
  remake: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const count = Math.min(2, hand.length);
      loggerService.debug(`[remake effect] selecting ${count} cards`);

      for (let i = 0; i < count; i++) {
        let selectedId = (await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: hand,
          count: 1,
        })) as CardId | null;
        if (!selectedId) {
          loggerService.warn(`[remake effect] no card selected to trash`);
          continue;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedId);

        loggerService.debug(`[remake effect] player ${cardEffectArgs.playerId} trashing ${selectedCard}`);

        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedId,
        });

        const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
          playerId: cardEffectArgs.playerId,
        });

        const availableCardIds = cardEffectArgs.findCardService.findCards({
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            {
              kind: 'exact',
              playerId: cardEffectArgs.playerId,
              amount: { ...cost, treasure: cost.treasure + 1 },
            },
          ],
        });

        if (!availableCardIds) {
          loggerService.debug(`[remake effect] no cards in supply with cost ${cost}`);
          continue;
        }

        selectedId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: availableCardIds.map(card => card.id),
          count: 1,
        });

        if (!selectedId) {
          loggerService.warn(`[remake effect] no card selected`);
          continue;
        }

        const card = cardEffectArgs.cardLibrary.getCard(selectedId);

        loggerService.debug(`[remake effect] player ${cardEffectArgs.playerId} gaining ${card}`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedId,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  renown: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const rule: CardPriceRule = (card, context) => {
        return {
          restricted: false,
          cost: {
            treasure: -2,
            potion: card.cost.potion,
          },
        };
      };

      const ruleSubs: (() => void)[] = [];
      const allCards = cardEffectArgs.cardLibrary.getAllCardsAsArray();
      for (const card of allCards) {
        ruleSubs.push(cardEffectArgs.cardPriceController.registerRule(card, rule));
      }

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `renown:${cardEffectArgs.cardId}:endTurn`,
        listeningFor: 'endTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: () => true,
        triggeredEffectFn: async () => {
          loggerService.debug(`[renown triggered effect] removing price rule`);
          for (const unsub of ruleSubs) {
            unsub();
          }
        },
      });
    },
  },
  shop: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[shop effect] drawing 1 card, and gaining 1 treasure`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const cardsInPlay = cardEffectArgs.findCardService.getCardsInPlay();

      const uniqueInPlayCardNames = new Set(cardsInPlay.map(card => card.cardName));

      const cardsInHand = cardEffectArgs.findCardService
        .findCards({
          location: 'playerHand',
          playerId: cardEffectArgs.playerId,
        })
        .filter(card => !uniqueInPlayCardNames.has(card.cardKey) && card.type.includes('ACTION'));

      if (cardsInHand.length === 0) {
        loggerService.debug(`[shop effect] no action cards in hand that are not in play`);
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play card?`,
        restrict: cardsInHand.map(card => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[shop effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      loggerService.debug(`[shop effect] player ${cardEffectArgs.playerId} playing ${selectedCard}`);

      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        overrides: {
          actionCost: 0,
        },
      });
    },
  },
  soothsayer: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const goldCardIds = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'basicSupply' }, { cardKeys: 'gold' }],
      });

      if (!goldCardIds.length) {
        loggerService.debug(`[soothsayer effect] no gold cards in supply`);
      } else {
        loggerService.debug(`[soothsayer effect] player ${cardEffectArgs.playerId} gaining gold`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: goldCardIds.slice(-1)[0].id,
          to: { location: 'playerDiscard' },
        });
      }

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const curseCardIds = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'basicSupply' }, { cardKeys: 'curse' }],
        });

        if (!curseCardIds.length) {
          loggerService.debug(`[soothsayer effect] no curse cards in supply`);
          break;
        }

        loggerService.debug(`[soothsayer effect] player ${targetPlayerId} gaining a curse`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: targetPlayerId,
          cardId: curseCardIds.slice(-1)[0].id,
          to: { location: 'playerDiscard' },
        });

        loggerService.debug(`[soothsayer effect] player ${targetPlayerId} drawing 1 card`);

        await cardEffectArgs.actionService.run('drawCard', { playerId: targetPlayerId });
      }
    },
  },
  stonemason: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        if (!eventArgs.bought) {
          loggerService.debug(`[stonemason onGained effect] ${eventArgs.cardId} was not bought, skipping`);
          return;
        }

        const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
        const overpaid = boughtStats.paid - boughtStats.cost;

        if (overpaid <= 0) {
          loggerService.debug(`[stonemason onGained effect] ${eventArgs.cardId} was not overpaid, skipping`);
          return;
        }

        const cardIds = cardEffectArgs.findCardService.findCards({
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { cardType: 'ACTION' },
            {
              playerId: eventArgs.playerId,
              kind: 'exact',
              amount: { treasure: overpaid },
            },
          ],
        });

        if (!cardIds.length) {
          loggerService.debug(`[stonemason triggered effect] no cards in supply with cost ${overpaid}`);
          return;
        }

        const numToGain = Math.min(2, cardIds.length);

        loggerService.debug(`[stonemason onGained effect] gaining ${numToGain} cards`);

        for (let i = 0; i < numToGain; i++) {
          const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
            playerId: eventArgs.playerId,
            prompt: `Gain card`,
            restrict: cardIds.map(card => card.id),
            count: 1,
          });

          if (!selectedCardId) {
            loggerService.warn(`[stonemason triggered effect] no card selected`);
            continue;
          }

          const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);

          loggerService.debug(`[stonemason onGained effect] player ${eventArgs.playerId} gaining ${card}`);

          await cardEffectArgs.actionService.run('gainCard', {
            playerId: eventArgs.playerId,
            cardId: selectedCardId,
            to: { location: 'playerDiscard' },
          });
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      if (hand.length === 0) {
        loggerService.debug(`[stonemason effect] no cards in hand`);
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: hand,
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[stonemason effect] no card selected`);
        return;
      }

      const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[stonemason effect] player ${cardEffectArgs.playerId} trashing ${card}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
        playerId: cardEffectArgs.playerId,
      });

      const cardIds = cardEffectArgs.findCardService.findCards({
        all: [
          { location: ['basicSupply', 'kingdomSupply'] },
          {
            kind: 'upTo',
            playerId: cardEffectArgs.playerId,
            amount: {
              treasure: cost.treasure - 1,
              potion: 1,
            },
          },
        ],
      });

      if (!cardIds.length) {
        loggerService.debug(`[stonemason effect] no cards in supply with cost ${cost} or less to gain`);
        return;
      }

      const numToGain = Math.min(2, cardIds.length);

      loggerService.debug(`[stonemason effect] player ${cardEffectArgs.playerId} gaining ${numToGain} cards`);

      for (let i = 0; i < numToGain; i++) {
        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cardIds.map(card => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[stonemason effect] no card selected`);
          continue;
        }

        const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[stonemason effect] player ${cardEffectArgs.playerId} gaining ${card}`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'young-witch': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[young witch effect] drawing 2 cards`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const count = Math.min(2, hand.length);

      loggerService.debug(`[young witch effect] selecting ${count} cards`);

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count,
      });

      if (!selectedCardIds.length) {
        loggerService.debug(`[young witch effect] no cards selected`);
      } else {
        loggerService.debug(
          `[young witch effect] player ${cardEffectArgs.playerId} discarding ${selectedCardIds.length} cards`,
        );

        for (const selectedCardId of selectedCardIds) {
          await cardEffectArgs.actionService.run('discardCard', {
            cardId: selectedCardId,
            playerId: cardEffectArgs.playerId,
          });
        }
      }

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const handIds = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        const handCards = handIds.map(cardId => cardEffectArgs.cardLibrary.getCard(cardId));
        const baneCards = handCards.filter(card => card.tags?.includes('bane'));

        const curseCardIds = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'basicSupply' }, { cardKeys: 'curse' }],
        });

        if (!curseCardIds.length) {
          loggerService.debug(`[young witch effect] no curse cards in supply`);
          return;
        }

        let reveal = false;

        if (baneCards.length > 0) {
          loggerService.debug(`[young witch effect] player ${targetPlayerId} has a bane, asking to reveal`);
          const baneCard = baneCards[0];
          const result = (await cardEffectArgs.actionService.run('userPrompt', {
            prompt: `Reveal ${baneCard.cardName}`,
            playerId: targetPlayerId,
            actionButtons: [
              { label: 'Cancel', action: 1 },
              { label: 'Reveal', action: 2 },
            ],
          })) as { action: number; result: number[] };

          reveal = result.action === 2;

          if (result.action === 2) {
            loggerService.debug(`[young witch effect] player ${targetPlayerId} revealed a bane`);
            await cardEffectArgs.actionService.run('revealCard', {
              cardId: baneCard.id,
              playerId: targetPlayerId,
            });
          }
        } else {
          reveal = false;
        }

        if (!reveal) {
          loggerService.debug(`[young witch effect] player ${targetPlayerId} did not reveal a bane`);
          await cardEffectArgs.actionService.run('gainCard', {
            playerId: targetPlayerId,
            // Gain from the TOP of the pile — index 0 is the bottom.
            cardId: curseCardIds.slice(-1)[0].id,
            to: { location: 'playerDiscard' },
          });
        }
      }
    },
  },
};

export default expansion;
