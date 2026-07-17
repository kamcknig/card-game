import { Card, CardId, CardKey } from 'shared/types/index.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { getPlayerStartingFrom } from '@shared/get-player-position-utils.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { getAttackTargets } from '../../utils/get-attack-targets.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { revealTopDeckCards } from '../../utils/reveal-top-deck-cards.ts';
import { discardDownTo } from '../../utils/discard-down-to.ts';

const expansion: CardExpansionModule = {
  advisor: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[advisor effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      loggerService.debug(`[advisor effect] revealing 3 cards`);

      // Reveal the top 3 cards, set aside — shuffling the discard back in
      // automatically if the deck runs dry mid-reveal.
      const cardsRevealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 3, { setAside: true });

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
  'bag-of-gold': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[bag of gold effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      loggerService.debug(`[bag of gold effect] gaining gold onto deck`);

      const gainedGoldId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'gold',
        from: 'basicSupply',
        to: { location: 'playerDeck' },
        logTag: 'bag-of-gold effect',
      });

      if (!gainedGoldId) {
        loggerService.debug(`[bag of gold effect] no gold cards in supply`);
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
      const cardsToKeep: Card[] = [];
      const cardsToDiscard: Card[] = [];

      // Reveal the top 4 cards, set aside — shuffling the discard back in
      // automatically if the deck runs dry mid-reveal.
      const revealedCards = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 4, { setAside: true });

      for (const revealedCard of revealedCards) {
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

      for (let i = 0; i < 2; i++) {
        loggerService.debug(
          `[coronet effect] processing ${
            i === 0 ? 'non-reward action instruction' : 'non-reward treasure instruction'
          }`,
        );

        const handCards = cardEffectArgs.findCardService.findCards({
          location: 'playerHand',
          playerId: cardEffectArgs.playerId,
        });
        const cardSource = handCards.filter(
          card => !card.type.includes('REWARD') && card.type.includes(i === 0 ? 'ACTION' : 'TREASURE'),
        );

        if (cardSource.length === 0) {
          loggerService.debug(`[coronet effect] no non-reward ${i === 0 ? 'action' : 'treasure'} cards in hand`);
          continue;
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
          continue;
        }

        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[coronet effect] playing ${selectedCard} twice`);

        for (let j = 0; j < 2; j++) {
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

      loggerService.debug(`[demesne effect] gaining gold`);

      const gainedGoldId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'gold',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'demesne effect',
      });

      if (!gainedGoldId) {
        loggerService.debug(`[demesne effect] no gold cards in supply`);
      }
    },
  },
  diadem: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // "+$1 per unused Action you have" reads the scalar action count
      // directly off the match (cf. rising-sun's Divine Wind availability
      // check), not the number of Action cards in hand/play.
      const unusedActions = Math.max(0, cardEffectArgs.match.playerActions);
      loggerService.debug(
        `[diadem effect] gaining ${2 + unusedActions} treasure (2 base + ${unusedActions} unused action(s))`,
      );
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 + unusedActions });
    },
  },
  doctor: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;

        if (!eventArgs.bought) {
          loggerService.debug(`[doctor onGained] ${eventArgs.cardId} was not bought, skipping`);
          return;
        }

        const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
        const overpaid = boughtStats.paid - boughtStats.cost;

        if (overpaid <= 0) {
          loggerService.debug(`[doctor onGained] no overpay cost spent for ${eventArgs.cardId}`);
          return;
        }

        loggerService.debug(
          `[doctor onGained] player ${eventArgs.playerId} overpaid ${overpaid}, looking at top card ${overpaid} time(s)`,
        );

        for (let i = 0; i < overpaid; i++) {
          // Reveal the top card one at a time, set aside — shuffling the
          // discard back in automatically if the deck runs dry mid-reveal.
          const revealed = await revealTopDeckCards(cardEffectArgs, eventArgs.playerId, 1, { setAside: true });
          const card = revealed[0];

          if (!card) {
            loggerService.debug(`[doctor onGained] no cards left to look at`);
            break;
          }

          const choice = (await cardEffectArgs.actionService.run('userPrompt', {
            prompt: `Top card: ${card.cardName}`,
            playerId: eventArgs.playerId,
            actionButtons: [
              { label: 'TRASH', action: 1 },
              { label: 'DISCARD', action: 2 },
              { label: 'PUT BACK', action: 3 },
            ],
          })) as { action: number; result: number[] };

          if (choice.action === 1) {
            loggerService.debug(`[doctor onGained] player ${eventArgs.playerId} trashing ${card}`);
            await cardEffectArgs.actionService.run('trashCard', { playerId: eventArgs.playerId, cardId: card.id });
          } else if (choice.action === 2) {
            loggerService.debug(`[doctor onGained] player ${eventArgs.playerId} discarding ${card}`);
            await cardEffectArgs.actionService.run('discardCard', { playerId: eventArgs.playerId, cardId: card.id });
          } else {
            loggerService.debug(`[doctor onGained] player ${eventArgs.playerId} putting ${card} back on top of deck`);
            await cardEffectArgs.actionService.run('moveCard', {
              cardId: card.id,
              toPlayerId: eventArgs.playerId,
              to: { location: 'playerDeck' },
            });
          }
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;

      const named = (await cardEffectArgs.actionService.run('userPrompt', {
        prompt: 'Name a card',
        playerId: cardEffectArgs.playerId,
        content: { type: 'name-card' },
      })) as { action: number; result: CardKey };

      loggerService.debug(`[doctor effect] player ${cardEffectArgs.playerId} named ${named.result}`);

      // Reveal the top 3 cards, set aside — shuffling the discard back in
      // automatically if the deck runs dry mid-reveal.
      const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 3, { setAside: true });
      const matches = revealed.filter(card => card.cardKey === named.result);
      const rest = revealed.filter(card => card.cardKey !== named.result);

      loggerService.debug(
        `[doctor effect] trashing ${matches.length} matching card(s), putting ${rest.length} back`,
      );

      for (const card of matches) {
        await cardEffectArgs.actionService.run('trashCard', { playerId: cardEffectArgs.playerId, cardId: card.id });
      }

      if (rest.length === 0) {
        loggerService.debug(`[doctor effect] no cards left to put back`);
        return;
      }

      const ordered =
        rest.length === 1
          ? rest.map(card => card.id)
          : ((await cardEffectArgs.actionService.run('userPrompt', {
              prompt: 'Put back on top of your deck in any order',
              playerId: cardEffectArgs.playerId,
              actionButtons: [{ label: 'DONE', action: 1 }],
              content: { type: 'rearrange', cardIds: rest.map(card => card.id) },
            })) as { action: number; result: CardId[] }).result;

      loggerService.debug(`[doctor effect] putting ${ordered.length} card(s) back on top of deck`);

      for (const cardId of ordered) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  fairgrounds: {
    registerScoringFunction: () => args => {
      const cards = args.cardLibrary.getAllCardsAsArray().filter(card => card.owner === args.ownerId);
      const uniqueNameCardCount = new Set(cards.map(card => card.cardName)).size;
      return 2 * Math.floor(uniqueNameCardCount / 5);
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
            id: `farmhands:${cardId}:startTurn`,
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
  'farming-village': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[farming village effect] gaining 2 actions`);
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const cardsToDiscard: CardId[] = [];

      // Reveal cards one at a time, set aside, stopping at the first
      // Treasure or Action card; revealTopDeckCards shuffles the discard
      // in automatically whenever the deck runs dry mid-reveal.
      while (true) {
        const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1, { setAside: true });
        const card = revealed[0];

        if (!card) {
          loggerService.debug(`[farming village effect] no cards left to reveal`);
          break;
        }

        loggerService.debug(`[farming village effect] revealed ${card}`);

        if (card.type.includes('ACTION') || card.type.includes('TREASURE')) {
          loggerService.debug(`[farming village effect] moving ${card} to hand`);
          await cardEffectArgs.actionService.run('moveCard', {
            cardId: card.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' },
          });
          break;
        }

        cardsToDiscard.push(card.id);
      }

      loggerService.debug(`[farming village effect] discarding ${cardsToDiscard.length} cards`);

      for (const cardId of cardsToDiscard) {
        await cardEffectArgs.actionService.run('discardCard', { cardId, playerId: cardEffectArgs.playerId });
      }
    },
  },
  farrier: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        if (!eventArgs.bought) {
          return;
        }

        const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
        const overpaid = boughtStats.paid - boughtStats.cost;

        if (overpaid <= 0) {
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
              { source: eventArgs.cardId },
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
          { source: eventArgs.cardId },
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
  followers: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[followers effect] drawing 2 cards`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });

      loggerService.debug(`[followers effect] gaining an estate`);

      const gainedEstateId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'estate',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'followers effect',
      });

      if (!gainedEstateId) {
        loggerService.debug(`[followers effect] no estate cards in supply`);
      }

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        loggerService.debug(`[followers effect] player ${targetPlayerId} gaining a curse`);

        const gainedCurseId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: targetPlayerId,
          pileKey: 'curse',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'followers effect',
        });

        if (!gainedCurseId) {
          loggerService.debug(`[followers effect] no curse cards in supply`);
        }

        await discardDownTo(
          {
            cardSourceController: cardEffectArgs.cardSourceController,
            actionService: cardEffectArgs.actionService,
            cardLibrary: cardEffectArgs.cardLibrary,
            loggerService: cardEffectArgs.loggerService,
          },
          {
            playerId: targetPlayerId,
            targetHandSize: 3,
            prompt: 'Discard down to 3 cards',
            logTag: 'followers effect',
          },
        );
      }
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
          playerId: targetPlayerId,
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
  'fortune-teller': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[fortune teller effect] gaining 2 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const cardsToDiscard: CardId[] = [];

        // Reveal cards one at a time, set aside, stopping at the first
        // Victory or Curse card; revealTopDeckCards shuffles the discard
        // in automatically whenever the deck runs dry mid-reveal.
        while (true) {
          const revealed = await revealTopDeckCards(cardEffectArgs, targetPlayerId, 1, { setAside: true });
          const card = revealed[0];

          if (!card) {
            loggerService.debug(`[fortune teller effect] player ${targetPlayerId} out of cards to reveal`);
            break;
          }

          loggerService.debug(`[fortune teller effect] player ${targetPlayerId} revealed ${card}`);

          if (card.type.includes('VICTORY') || card.type.includes('CURSE')) {
            loggerService.debug(`[fortune teller effect] putting ${card} back on top of deck`);
            await cardEffectArgs.actionService.run('moveCard', {
              cardId: card.id,
              toPlayerId: targetPlayerId,
              to: { location: 'playerDeck' },
            });
            break;
          }

          cardsToDiscard.push(card.id);
        }

        loggerService.debug(
          `[fortune teller effect] player ${targetPlayerId} discarding ${cardsToDiscard.length} cards`,
        );

        for (const cardId of cardsToDiscard) {
          await cardEffectArgs.actionService.run('discardCard', { cardId, playerId: targetPlayerId });
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
  harvest: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;

      // Reveal the top 4 cards, set aside — shuffling the discard back in
      // automatically if the deck runs dry mid-reveal.
      const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 4, { setAside: true });

      const distinctNames = new Set(revealed.map(card => card.cardName)).size;
      loggerService.debug(`[harvest effect] revealed ${revealed.length} cards, ${distinctNames} distinct names`);

      if (distinctNames > 0) {
        await cardEffectArgs.actionService.run('gainTreasure', { count: distinctNames });
      }

      loggerService.debug(`[harvest effect] discarding ${revealed.length} cards`);

      for (const card of revealed) {
        await cardEffectArgs.actionService.run('discardCard', { cardId: card.id, playerId: cardEffectArgs.playerId });
      }
    },
  },
  herald: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;

        if (!eventArgs.bought) {
          loggerService.debug(`[herald onGained effect] ${eventArgs.cardId} was not bought, skipping`);
          return;
        }

        const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
        const overpaid = boughtStats.paid - boughtStats.cost;

        if (overpaid <= 0) {
          loggerService.debug(`[herald onGained effect] no overpay cost spent for ${eventArgs.cardId}`);
          return;
        }

        loggerService.debug(`[herald onGained effect] ${eventArgs.playerId} overpaid for ${eventArgs.cardId}`);

        const discardIds = cardEffectArgs.findCardService
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

        const result = (await cardEffectArgs.actionService.run('userPrompt', {
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

        loggerService.debug(`[herald onGained effect] putting ${result.result.length} cards on top of deck`);

        for (const cardId of result.result) {
          await cardEffectArgs.actionService.run('moveCard', {
            cardId: cardId,
            toPlayerId: eventArgs.playerId,
            to: { location: 'playerDeck' },
          });
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[herald effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Reveal the top card of the deck, shuffling the discard in
      // automatically if the deck is empty.
      const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1);
      const card = revealed[0];

      if (!card) {
        loggerService.debug(`[herald effect] no cards in deck after shuffling`);
        return;
      }

      loggerService.debug(`[herald effect] player ${cardEffectArgs.playerId} revealing ${card}`);

      if (card.type.includes('ACTION')) {
        loggerService.debug(`[herald effect] card is an action card, playing it`);
        await cardEffectArgs.actionService.run('playCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
          overrides: {
            actionCost: 0,
          },
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
  'horse-traders': {
    registerLifeCycleMethods: () => ({
      // Tear down the pending "another player plays an Attack" reaction the
      // moment this card leaves the hand it was registered against — whether
      // that's because it was set aside (the reaction fired) or it was
      // played/discarded/trashed by some other means. The startTurn return
      // reaction (registered inside the triggeredEffectFn below) uses a
      // separate id, so unregistering this one never touches it.
      onLeaveHand: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        loggerService.debug(`[horse traders onLeaveHand] unregistering cardPlayed reaction for ${eventArgs.cardId}`);
        args.reactionManager.unregisterTrigger(`horse-traders:${eventArgs.cardId}:cardPlayed`);
      },
      onEnterHand: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        loggerService.debug(`[horse traders onEnterHand] registering cardPlayed reaction for ${eventArgs.cardId}`);

        args.reactionManager.registerReactionTemplate({
          id: `horse-traders:${eventArgs.cardId}:cardPlayed`,
          playerId: eventArgs.playerId,
          listeningFor: 'cardPlayed',
          once: false,
          allowMultipleInstances: true,
          compulsory: false,
          condition: conditionArgs => {
            if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
            return conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId).type.includes('ATTACK');
          },
          triggeredEffectFn: async triggeredArgs => {
            const result = (await triggeredArgs.actionService.run('userPrompt', {
              prompt: 'Set aside Horse Traders?',
              playerId: eventArgs.playerId,
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'SET ASIDE', action: 2 },
              ],
            })) as { action: number; result: number[] };

            if (result.action !== 2) {
              loggerService.debug(`[horse traders triggered effect] player ${eventArgs.playerId} declined to set aside`);
              return;
            }

            loggerService.debug(`[horse traders triggered effect] setting aside ${eventArgs.cardId}`);

            const setAside = await triggeredArgs.actionService.run('moveCard', {
              cardId: eventArgs.cardId,
              toPlayerId: eventArgs.playerId,
              to: { location: 'set-aside' },
              expectedFrom: { location: 'playerHand', playerId: eventArgs.playerId },
            });

            if (!setAside) {
              loggerService.debug(
                `[horse traders triggered effect] lose track — ${eventArgs.cardId} was not in hand, aborting set aside`,
              );
              return;
            }

            triggeredArgs.reactionManager.registerReactionTemplate({
              id: `horse-traders:${eventArgs.cardId}:startTurn`,
              listeningFor: 'startTurn',
              playerId: eventArgs.playerId,
              once: true,
              compulsory: true,
              allowMultipleInstances: true,
              condition: conditionArgs => conditionArgs.trigger.args.playerId === eventArgs.playerId,
              triggeredEffectFn: async startArgs => {
                loggerService.debug(
                  `[horse traders triggered effect] returning ${eventArgs.cardId} to hand and drawing a card`,
                );
                await startArgs.actionService.run('drawCard', { playerId: eventArgs.playerId });
                await startArgs.actionService.run('moveCard', {
                  cardId: eventArgs.cardId,
                  toPlayerId: eventArgs.playerId,
                  to: { location: 'playerHand' },
                  expectedFrom: { location: 'set-aside', playerId: eventArgs.playerId },
                });
              },
            });
          },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[horse traders effect] gaining 1 buy, and 3 treasure`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const count = Math.min(2, hand.length);

      loggerService.debug(`[horse traders effect] discarding ${count} cards`);

      const toDiscard = await cardEffectArgs.actionService.run('selectCard', {
        prompt: 'Discard 2 cards',
        playerId: cardEffectArgs.playerId,
        restrict: hand,
        count,
      });

      for (const cardId of toDiscard) {
        await cardEffectArgs.actionService.run('discardCard', { cardId, playerId: cardEffectArgs.playerId });
      }
    },
  },
  housecarl: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const uniqueActionCardsInPlay = Array.from(
        cardEffectArgs.findCardService
          .getCardsInPlay()
          .filter(card => card.type.includes('ACTION') && card.owner === cardEffectArgs.playerId)
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

      const cardsToDiscard: CardId[] = [];

      // Reveal cards one at a time, set aside, stopping after the first
      // card that doesn't match a card name in hand; revealTopDeckCards
      // shuffles the discard in automatically whenever the deck runs dry
      // mid-reveal.
      while (true) {
        const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1, { setAside: true });
        const card = revealed[0];

        if (!card) {
          loggerService.warn(`[hunting party effect] no cards in deck after shuffling`);
          return;
        }

        loggerService.debug(`[hunting party effect] revealing ${card}`);

        if (uniqueHandCardNames.has(card.cardName)) {
          loggerService.debug(`[hunting party effect] adding ${card.cardName} to discards`);
          cardsToDiscard.push(card.id);
        } else {
          loggerService.debug(`[hunting party effect] moving ${card.cardName} to hand`);
          await cardEffectArgs.actionService.run('moveCard', {
            cardId: card.id,
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

        if (!eventArgs.bought) {
          loggerService.debug(`[infirmary onGained] ${eventArgs.cardId} was not bought, skipping`);
          return;
        }

        const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
        const overpaid = boughtStats.paid - boughtStats.cost;
        if (overpaid <= 0) {
          loggerService.debug(`[infirmary onGained] no overpay cost spent for ${eventArgs.cardId}`);
          return;
        }

        loggerService.debug(`[infirmary onGained] ${eventArgs.playerId} overpaid for ${eventArgs.cardId}`);

        for (let i = 0; i < overpaid; i++) {
          await cardEffectArgs.actionService.run('playCard', {
            playerId: eventArgs.playerId,
            cardId: eventArgs.cardId,
            overrides: {
              actionCost: 0,
            },
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

          const gainedCurseId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: targetPlayerId,
            pileKey: 'curse',
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'jester effect',
          });

          if (!gainedCurseId) {
            loggerService.debug(`[jester effect] no curse cards in supply`);
            continue;
          }
        } else {
          const copyCard = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({
            pileKey: card.cardKey,
            from: ['basicSupply', 'kingdomSupply'],
          });

          if (!copyCard) {
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

          const recipientPlayerId = result.action === 1 ? targetPlayerId : cardEffectArgs.playerId;
          loggerService.debug(`[jester effect] player ${recipientPlayerId} gaining ${card.cardName}`);

          await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: recipientPlayerId,
            pileKey: card.cardKey,
            from: ['basicSupply', 'kingdomSupply'],
            to: { location: 'playerDiscard' },
            logTag: 'jester effect',
          });
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

      let count = 0;
      const cardsToDiscard: CardId[] = [];
      // Reveal cards one at a time, set aside, until 3 non-matching cards
      // have been moved to hand or the player runs out of cards;
      // revealTopDeckCards shuffles the discard in automatically whenever
      // the deck runs dry mid-reveal.
      while (count < 3) {
        const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1, { setAside: true });
        const card = revealed[0];
        if (!card) {
          loggerService.warn(`[journeyman effect] no cards in deck after shuffling`);
          break;
        }

        if (card.cardKey === key) {
          cardsToDiscard.push(card.id);
        } else {
          await cardEffectArgs.actionService.run('moveCard', {
            cardId: card.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' },
          });
          count++;
        }
      }

      loggerService.debug(`[journeyman effect] discarding ${cardsToDiscard.length} matching cards`);
      for (const cardId of cardsToDiscard) {
        await cardEffectArgs.actionService.run('discardCard', { cardId, playerId: cardEffectArgs.playerId });
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
        id: `joust:${provinceCard.id}:startPhase`,
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
  masterpiece: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;

        if (!eventArgs.bought) {
          loggerService.debug(`[masterpiece onGained] ${eventArgs.cardId} was not bought, skipping`);
          return;
        }

        const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
        const overpaid = boughtStats.paid - boughtStats.cost;

        if (overpaid <= 0) {
          loggerService.debug(`[masterpiece onGained] no overpay cost spent for ${eventArgs.cardId}`);
          return;
        }

        const silverCardIds = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'basicSupply' }, { cardKeys: 'silver' }],
        });

        const numToGain = Math.min(overpaid, silverCardIds.length);

        loggerService.debug(
          `[masterpiece onGained] player ${eventArgs.playerId} overpaid ${overpaid}, gaining ${numToGain} silver(s)`,
        );

        for (let i = 0; i < numToGain; i++) {
          await cardEffectArgs.actionService.run('gainCard', {
            playerId: eventArgs.playerId,
            cardId: silverCardIds.slice(-(i + 1))[0].id,
            to: { location: 'playerDiscard' },
          });
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[masterpiece effect] gaining 1 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
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
    registerEffects: () => {
      const playCountByCardId: Record<CardId, number> = {};

      return async cardEffectArgs => {
        const loggerService = cardEffectArgs.loggerService;
        loggerService.debug(`[merchant guild effect] gaining 1 buy, and 1 treasure`);
        await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
        await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

        const cardId = cardEffectArgs.cardId;
        const playInstance = (playCountByCardId[cardId] ?? 0) + 1;
        playCountByCardId[cardId] = playInstance;

        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `merchant-guild:${cardId}:${playInstance}:endTurnPhase`,
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
              cardIdsGainedThisTurn?.filter(
                gainedCardId =>
                  stats.cardsGained[gainedCardId].playerId === cardEffectArgs.playerId &&
                  stats.cardsGained[gainedCardId].turnPhase === 'buy',
              ) ?? [];

            if (!selfGainedCardIdsThisTurn.length) {
              loggerService.debug(`[merchant guild triggered effect] no cards gained this buy phase`);
              return;
            }

            loggerService.debug(
              `[merchant guild triggered effect] gaining ${selfGainedCardIdsThisTurn.length} coffers`,
            );

            await cardEffectArgs.actionService.run(
              'gainCoffer',
              {
                playerId: cardEffectArgs.playerId,
                count: selfGainedCardIdsThisTurn.length,
              },
              { source: cardEffectArgs.cardId },
            );
          },
        });
      };
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
  princess: {
    // Same additive cost-delta price-rule shape as Renown ($2 discount
    // instead of Renown's -2 discount to Actions — mechanically identical,
    // applied to every card in the library, torn down at end of turn).
    registerEffects: () => {
      const unsubsByCardId: Record<CardId, (() => void)[]> = {};

      return async cardEffectArgs => {
        const loggerService = cardEffectArgs.loggerService;
        loggerService.debug(`[princess effect] gaining 1 buy`);
        await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

        const rule: CardPriceRule = () => ({
          restricted: false,
          cost: { treasure: -2, potion: 0 },
        });

        const cardId = cardEffectArgs.cardId;
        const alreadyActiveThisTurn = (unsubsByCardId[cardId]?.length ?? 0) > 0;

        const allCards = cardEffectArgs.cardLibrary.getAllCardsAsArray();
        unsubsByCardId[cardId] ??= [];
        for (const card of allCards) {
          unsubsByCardId[cardId].push(cardEffectArgs.cardPriceController.registerRule(card, rule));
        }

        if (alreadyActiveThisTurn) {
          loggerService.debug(
            `[princess effect] card ${cardId} already active this turn, skipping cleanup registration`,
          );
          return;
        }

        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `princess:${cardId}:endTurn`,
          listeningFor: 'endTurn',
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: () => true,
          triggeredEffectFn: async () => {
            loggerService.debug(`[princess triggered effect] removing price rule`);
            unsubsByCardId[cardId].forEach(unsub => unsub());
            delete unsubsByCardId[cardId];
          },
        });
      };
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
    registerEffects: () => {
      const unsubsByCardId: Record<CardId, (() => void)[]> = {};

      return async cardEffectArgs => {
        const loggerService = cardEffectArgs.loggerService;
        await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

        const rule: CardPriceRule = () => ({
          restricted: false,
          cost: { treasure: -2, potion: 0 },
        });

        const cardId = cardEffectArgs.cardId;
        const alreadyActiveThisTurn = (unsubsByCardId[cardId]?.length ?? 0) > 0;

        const allCards = cardEffectArgs.cardLibrary.getAllCardsAsArray();
        unsubsByCardId[cardId] ??= [];
        for (const card of allCards) {
          unsubsByCardId[cardId].push(cardEffectArgs.cardPriceController.registerRule(card, rule));
        }

        if (alreadyActiveThisTurn) {
          loggerService.debug(
            `[renown effect] card ${cardId} already active this turn, skipping cleanup registration`,
          );
          return;
        }

        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `renown:${cardId}:endTurn`,
          listeningFor: 'endTurn',
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: () => true,
          triggeredEffectFn: async () => {
            loggerService.debug(`[renown triggered effect] removing price rule`);
            unsubsByCardId[cardId].forEach(unsub => unsub());
            delete unsubsByCardId[cardId];
          },
        });
      };
    },
  },
  shop: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[shop effect] drawing 1 card, and gaining 1 treasure`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const cardsInPlay = cardEffectArgs.findCardService.getCardsInPlay();

      const uniqueInPlayCardKeys = new Set(
        cardsInPlay.filter(card => card.owner === cardEffectArgs.playerId).map(card => card.cardKey),
      );

      const cardsInHand = cardEffectArgs.findCardService
        .findCards({
          location: 'playerHand',
          playerId: cardEffectArgs.playerId,
        })
        .filter(card => !uniqueInPlayCardKeys.has(card.cardKey) && card.type.includes('ACTION'));

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
      loggerService.debug(`[soothsayer effect] player ${cardEffectArgs.playerId} gaining gold`);

      const gainedGoldId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'gold',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'soothsayer effect',
      });

      if (!gainedGoldId) {
        loggerService.debug(`[soothsayer effect] no gold cards in supply`);
      }

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        loggerService.debug(`[soothsayer effect] player ${targetPlayerId} gaining a curse`);

        const gainedCurseId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: targetPlayerId,
          pileKey: 'curse',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'soothsayer effect',
        });

        if (!gainedCurseId) {
          loggerService.debug(`[soothsayer effect] no curse cards in supply`);
          break;
        }

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
              potion: cost.potion ?? 0,
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
  taxman: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;

      const treasureId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a Treasure',
        optional: true,
        count: 1,
        restrict: {
          all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }, { cardType: 'TREASURE' }],
        },
      });

      if (!treasureId) {
        loggerService.debug(`[taxman effect] no treasure trashed`);
        return;
      }

      const trashed = cardEffectArgs.cardLibrary.getCard(treasureId);

      loggerService.debug(`[taxman effect] player ${cardEffectArgs.playerId} trashing ${trashed}`);

      await cardEffectArgs.actionService.run('trashCard', { playerId: cardEffectArgs.playerId, cardId: treasureId });

      // Each other player with 5+ cards in hand discards a copy of the
      // trashed Treasure (or reveals their hand if they can't).
      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);

        if (hand.length < 5) {
          loggerService.debug(`[taxman effect] player ${targetPlayerId} has fewer than 5 cards, skipping`);
          continue;
        }

        const copyId = hand.find(cardId => cardEffectArgs.cardLibrary.getCard(cardId).cardKey === trashed.cardKey);

        if (copyId) {
          loggerService.debug(`[taxman effect] player ${targetPlayerId} discarding a copy of ${trashed.cardName}`);
          await cardEffectArgs.actionService.run('discardCard', { cardId: copyId, playerId: targetPlayerId });
          continue;
        }

        loggerService.debug(`[taxman effect] player ${targetPlayerId} has no copy of ${trashed.cardName}, revealing hand`);
        for (const cardId of hand) {
          await cardEffectArgs.actionService.run('revealCard', { cardId, playerId: targetPlayerId });
        }
      }

      // Gain a Treasure onto the deck costing up to $3 more than the
      // trashed one. `amount` omits potion/debt so they default to 0,
      // which naturally excludes Potion- or Debt-costed Treasures from a
      // plain "$X more" range.
      const maxTreasure = (trashed.cost.treasure ?? 0) + 3;
      const gainable = cardEffectArgs.findCardService.findCards({
        all: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { cardType: 'TREASURE' },
          { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: maxTreasure } },
        ],
      });

      if (!gainable.length) {
        loggerService.debug(`[taxman effect] no gainable treasure costing up to ${maxTreasure}`);
        return;
      }

      const chosenId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a Treasure onto your deck',
        count: 1,
        restrict: gainable.map(card => card.id),
      });

      if (!chosenId) {
        loggerService.warn(`[taxman effect] no treasure selected`);
        return;
      }

      const gainedCard = cardEffectArgs.cardLibrary.getCard(chosenId);

      loggerService.debug(`[taxman effect] player ${cardEffectArgs.playerId} gaining ${gainedCard} onto deck`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: chosenId,
        to: { location: 'playerDeck' },
      });
    },
  },
  tournament: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[tournament effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // "Each player may reveal a Province from their hand" applies to
      // every player, including the active player, not just opponents —
      // whoever reveals discards it and gains a Prize or Duchy onto their
      // own deck. Only the +1 Card/+$1 bonus is gated on "if no-one else
      // does". Resolve in turn order starting with the active player
      // (Dominion's general rule for simultaneous multi-player effects
      // where a limited resource, here the Prize pile, could run out) —
      // same ALL-target ordering idiom as Masquerade.
      const orderedPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL',
        startingPlayerId: cardEffectArgs.playerId,
      });

      let anyOtherPlayerRevealed = false;

      for (const targetPlayerId of orderedPlayerIds) {
        const provinceId = cardEffectArgs.cardSourceController
          .getSource('playerHand', targetPlayerId)
          .find(cardId => cardEffectArgs.cardLibrary.getCard(cardId).cardKey === 'province');

        if (!provinceId) {
          loggerService.debug(`[tournament effect] player ${targetPlayerId} has no province in hand`);
          continue;
        }

        const reveal = (await cardEffectArgs.actionService.run('userPrompt', {
          prompt: 'Reveal a Province to gain a Prize or a Duchy?',
          playerId: targetPlayerId,
          actionButtons: [
            { label: 'NO', action: 1, role: 'cancel' },
            { label: 'REVEAL', action: 2 },
          ],
        })) as { action: number; result: number[] };

        if (reveal.action !== 2) {
          loggerService.debug(`[tournament effect] player ${targetPlayerId} chose not to reveal`);
          continue;
        }

        if (targetPlayerId !== cardEffectArgs.playerId) {
          anyOtherPlayerRevealed = true;
        }

        loggerService.debug(`[tournament effect] player ${targetPlayerId} revealing and discarding province`);
        await cardEffectArgs.actionService.run('revealCard', { cardId: provinceId, playerId: targetPlayerId });
        await cardEffectArgs.actionService.run('discardCard', { cardId: provinceId, playerId: targetPlayerId });

        // Gain any remaining Prize from the Prize pile, or a Duchy, onto
        // the revealer's deck. Re-queried per revealer so an earlier
        // revealer taking a Prize is reflected for the next one.
        const prizeCards = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'nonSupplyCards' }, { cardType: 'PRIZE' }],
        });
        const duchyCard = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({
          pileKey: 'duchy',
          from: 'basicSupply',
        });

        const gainOptionIds = [...prizeCards.map(card => card.id), ...(duchyCard ? [duchyCard.id] : [])];

        if (!gainOptionIds.length) {
          loggerService.debug(`[tournament effect] no prizes or duchies remain to gain`);
          continue;
        }

        const chosenId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: targetPlayerId,
          prompt: 'Gain a Prize or a Duchy onto your deck',
          restrict: gainOptionIds,
          count: 1,
        });

        if (!chosenId) {
          loggerService.warn(`[tournament effect] player ${targetPlayerId} did not select a gain option`);
          continue;
        }

        const gainedCard = cardEffectArgs.cardLibrary.getCard(chosenId);

        loggerService.debug(`[tournament effect] player ${targetPlayerId} gaining ${gainedCard} onto deck`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: targetPlayerId,
          cardId: chosenId,
          to: { location: 'playerDeck' },
        });
      }

      if (!anyOtherPlayerRevealed) {
        loggerService.debug(`[tournament effect] no other player revealed a province; +1 card, +$1`);
        await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
        await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
      }
    },
  },
  'trusty-steed': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Courser's exact "choose two different options" shape, plus a 4th
      // option that gains 4 Silvers and moves the whole deck to discard.
      const actions = [
        { label: '+2 Cards', action: 1 },
        { label: '+2 Actions', action: 2 },
        { label: '+$2', action: 3 },
        { label: 'Gain 4 Silvers; deck to discard', action: 4 },
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
            loggerService.debug(`[trusty steed effect] drawing 2 cards`);
            await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
            break;
          case 2:
            loggerService.debug(`[trusty steed effect] gaining 2 actions`);
            await cardEffectArgs.actionService.run('gainAction', { count: 2 });
            break;
          case 3:
            loggerService.debug(`[trusty steed effect] gaining 2 treasure`);
            await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
            break;
          case 4: {
            const silverCardIds = cardEffectArgs.findCardService.findCards({
              all: [{ location: 'basicSupply' }, { cardKeys: 'silver' }],
            });

            const numToGain = Math.min(4, silverCardIds.length);
            loggerService.debug(`[trusty steed effect] gaining ${numToGain} silver(s)`);

            for (let j = 0; j < numToGain; j++) {
              await cardEffectArgs.actionService.run('gainCard', {
                playerId: cardEffectArgs.playerId,
                cardId: silverCardIds.slice(-(j + 1))[0].id,
                to: { location: 'playerDiscard' },
              });
            }

            // "Put your deck into your discard pile" — snapshot the source
            // first since moveCard mutates it as we iterate.
            const deck = [...cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId)];
            loggerService.debug(`[trusty steed effect] moving ${deck.length} deck card(s) to discard`);

            for (const cardId of deck) {
              await cardEffectArgs.actionService.run('moveCard', {
                cardId,
                toPlayerId: cardEffectArgs.playerId,
                to: { location: 'playerDiscard' },
              });
            }

            break;
          }
        }
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

        const topCurseCard = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({
          pileKey: 'curse',
          from: 'basicSupply',
        });

        if (!topCurseCard) {
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
          await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: targetPlayerId,
            pileKey: 'curse',
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'young witch effect',
          });
        }
      }
    },
  },
};

export default expansion;
