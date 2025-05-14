import { Card, CardId, CardKey } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { getPlayerStartingFrom } from '../../shared/get-player-position-utils.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';

const expansion: CardExpansionModule = {
  'advisor': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[advisor effect] gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const cardsRevealed: Card[] = [];
      
      console.log(`[advisor effect] revealing 3 cards`);
      
      for (let i = 0; i < 3; i++) {
        if (deck.length === 0) {
          console.log(`[advisor effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          
          if (deck.length === 0) {
            console.log(`[advisor effect] no cards in deck after shuffling`);
            break;
          }
        }
        
        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        cardsRevealed.push(card);
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true
        });
      }
      
      const leftPlayer = getPlayerStartingFrom({
        startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
        match: cardEffectArgs.match,
        distance: -1
      });
      
      console.log(`[advisor effect] player ${leftPlayer} choosing card to discard`);
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: `Choose one for ${getPlayerById(cardEffectArgs.match, cardEffectArgs.playerId)?.name} to discard`,
        playerId: leftPlayer.id,
        content: {
          type: 'select',
          cardIds: cardsRevealed.map(card => card.id),
          selectCount: 1
        }
      }) as { action: number, result: number[] };
      
      const cardId = result.result[0];
      
      if (!cardId) {
        console.warn(`[advisor effect] no card selected`);
      }
      else {
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        console.log(`[advisor effect] player ${cardEffectArgs.playerId} discarding ${card}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', { cardId, playerId: cardEffectArgs.playerId });
      }
      
      const toMoveToHand = cardsRevealed.filter(card => card.id !== cardId);
      
      console.log(`[advisor effect] moving ${toMoveToHand.length} cards to hand`);
      
      for (const card of toMoveToHand) {
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: card.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHand' }
        });
      }
    }
  },
  'baker': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainCoffer', { playerId: cardEffectArgs.playerId, count: 1 });
    }
  },
  'butcher': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[butcher effect] gaining 2 coffers`);
      await cardEffectArgs.runGameActionDelegate('gainCoffer', { playerId: cardEffectArgs.playerId, count: 2 });
      
      let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card?`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
        optional: true,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[butcher effect] no card selected`);
        return;
      }
      
      let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, { playerId: cardEffectArgs.playerId });
      
      const cards = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        {
          kind: 'upTo', playerId: cardEffectArgs.playerId, amount: {
            treasure: cost.treasure + (cardEffectArgs.match.coffers[cardEffectArgs.playerId] ?? 0),
            potion: cost.potion
          }
        }
      ]);
      
      if (!cards.length) {
        console.log(`[butcher effect] no cards in supply that match cost`);
        return;
      }
      
      selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cards.map(card => card.id),
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[butcher effect] no card selected`);
        return;
      }
      
      selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      const { cost: selectedCardCost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, { playerId: cardEffectArgs.playerId });
      
      console.log(`[butcher effect] gaining ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' }
      });
      
      if (selectedCardCost.treasure - cost.treasure > 0) {
        console.log(`[butcher effect] spending ${selectedCardCost.treasure - cost.treasure} coffers`);
        await cardEffectArgs.runGameActionDelegate('gainCoffer', {
          playerId: cardEffectArgs.playerId,
          count: -(selectedCardCost.treasure - cost.treasure)
        });
      }
    }
  },
  'candlestick-maker': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[candlestick maker effect] gaining 1 action, 1 buy, and 1 coffer`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainCoffer', { playerId: cardEffectArgs.playerId, count: 1 });
    }
  },
  'carnival': {
    registerEffects: () => async (cardEffectArgs) => {
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const cardsToKeep: Card[] = [];
      const cardsToDiscard: Card[] = [];
      
      for (let i = 0; i < 4; i++) {
        if (deck.length === 0) {
          console.log(`[carnival effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          
          if (deck.length === 0) {
            console.log(`[carnival effect] no cards in deck after shuffling`);
            break;
          }
        }
        
        const revealedCardId = deck.slice(-1)[0];
        const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
        
        console.log(`[carnival effect] revealing ${revealedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: revealedCardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true
        });
        
        if (!cardsToKeep.find(card => card.cardKey === revealedCard.cardKey)) {
          console.log(`[carnival effect] adding ${revealedCard} to keep`);
          cardsToKeep.push(revealedCard);
        }
        else {
          console.log(`[carnival effect] adding ${revealedCard} to discard`);
          cardsToDiscard.push(revealedCard);
        }
      }
      
      console.log(`[carnival effect] discarding ${cardsToDiscard.length} cards`);
      
      for (const card of cardsToDiscard) {
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId
        });
      }
      
      console.log(`[carnival effect] moving ${cardsToKeep.length} cards to hand`);
      
      for (const card of cardsToKeep) {
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: card.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHand' }
        });
      }
    }
  },
  'coronet': {
    registerEffects: () => async (cardEffectArgs) => {
      const handCards = cardEffectArgs.findCards({ location: 'playerHand', playerId: cardEffectArgs.playerId });
      
      const cardSources = [
        handCards
          .filter(card => !card.type.includes('REWARD') && card.type.includes('ACTION')),
        handCards
          .filter(card => !card.type.includes('REWARD') && card.type.includes('TREASURE'))
      ]
      
      for (let i = 0; i < 2; i++) {
        console.log(`[coronet effect] processing ${i === 0 ? 'non-reward action instruction' : 'non-reward treasure instruction'}`);
        const cardSource = cardSources[i];
        
        if (cardSource.length === 0) {
          console.log(`[coronet effect] no non-reward action cards in hand`);
          return;
        }
        
        const uniqueCardNames = Array.from(new Set(cardSource.map(card => card.cardName)));
        
        let selectedCardId: CardId | undefined = undefined;
        
        if (uniqueCardNames.length === 1) {
          console.log(`[coronet effect] only one unique card in hand, prompting to play`);
          
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: `Play ${uniqueCardNames[0]}?`,
            playerId: cardEffectArgs.playerId,
            actionButtons: [
              { label: 'CANCEL', action: 1 }, { label: 'PLAY', action: 2 }
            ],
          }) as { action: number, result: number[] };
          
          if (result.action === 2) {
            selectedCardId = cardSource[0].id;
          }
        }
        else {
          console.log(`[coronet effect] multiple unique cards in hand, prompting to select`);
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Play non-Reward ${i === 0 ? 'Action' : 'Treasure'}?`,
            restrict: cardSource.map(card => card.id),
            count: 1,
            optional: true,
          }) as CardId[];
          
          if (selectedCardIds.length) {
            selectedCardId = selectedCardIds[0];
          }
        }
        
        if (!selectedCardId) {
          console.log(`[coronet effect] no card selected`);
          return;
        }
        
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
        
        console.log(`[coronet effect] playing ${selectedCard} twice`);
        
        for (let i = 0; i < 2; i++) {
          await cardEffectArgs.runGameActionDelegate('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
            overrides: {
              actionCost: 0
            }
          });
        }
      }
    }
  },
  'courser': {
    registerEffects: () => async (cardEffectArgs) => {
      const actions = [
        { label: '+2 Cards', action: 1 },
        { label: '+2 Actions', action: 2 },
        { label: '+2 Treasure', action: 3 },
        { label: 'Gain 4 Silvers', action: 4 },
      ];
      
      for (let i = 0; i < 2; i++) {
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Choose one',
          playerId: cardEffectArgs.playerId,
          actionButtons: actions,
        }) as { action: number, result: number[] };
        
        const idx = actions.findIndex(action => action.action === result.action);
        if (idx !== -1) {
          actions.splice(idx, 1);
        }
        
        switch (result.action) {
          case 1:
            await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
            break;
          case 2:
            await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
            break;
          case 3:
            await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
            break;
          case 4: {
            const silverCardIds = cardEffectArgs.findCards(
              [{ location: 'basicSupply' }, { cardKeys: 'silver' }]
            );
            
            const numToGain = Math.min(4, silverCardIds.length);
            for (let i = 0; i < numToGain; i++) {
              await cardEffectArgs.runGameActionDelegate('gainCard', {
                playerId: cardEffectArgs.playerId,
                cardId: silverCardIds.slice(-(i + 1))[0].id,
                to: { location: 'playerDiscard' }
              });
            }
            
            break;
          }
        }
      }
    }
  },
  'demesne': {
    registerScoringFunction: () => (args) => {
      const ownedGoldCards = args.findCards(
        [{ owner: args.ownerId }],
      )
        .filter(card => card.cardKey === 'gold');
      return ownedGoldCards.length;
    },
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[demesne effect] gaining 2 actions, and 2 buys`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 2 });
      
      const goldCardIds = cardEffectArgs.findCards(
        [{ location: 'basicSupply' }, { cardKeys: 'gold' }]
      );
      
      if (!goldCardIds.length) {
        console.log(`[demesne effect] no gold cards in supply`);
        return;
      }
      
      const goldCard = cardEffectArgs.cardLibrary.getCard(goldCardIds.slice(-1)[0].id);
      
      console.log(`[demesne effect] gaining ${goldCard}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: goldCard.id,
        to: { location: 'playerDiscard' }
      });
    }
  },
  'fairgrounds': {
    registerScoringFunction: () => (args) => {
      const cards = args.cardLibrary.getAllCardsAsArray().filter(card => card.owner === args.ownerId);
      const uniqueNameCardCount = new Set(cards.map(card => card.cardName)).size;
      const score = Math.floor(uniqueNameCardCount / 5);
      return score;
    }
  },
  'farmhands': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', eventArgs.playerId);
        const actionTreasureCards = hand
          .map(cardEffectArgs.cardLibrary.getCard)
          .filter(card => card.type.includes('ACTION') || card.type.includes('TREASURE'));
        
        if (actionTreasureCards.length === 0) {
          console.log(`[farmhands effect] no action or treasure cards in hand, not prompting to select`);
          return;
        }
        
        const result = await cardEffectArgs.runGameActionDelegate('selectCard', {
          prompt: 'Set aside?',
          playerId: eventArgs.playerId,
          optional: true,
          count: 1,
          restrict: [
            { location: 'playerHand', playerId: eventArgs.playerId },
            { cardType: ['ACTION', 'TREASURE'] }
          ],
        }) as CardId[];
        
        if (result.length) {
          const cardId = result[0];
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId,
            toPlayerId: eventArgs.playerId,
            to: { location: 'set-aside' }
          });
          
          cardEffectArgs.reactionManager.registerReactionTemplate({
            id: `farmhands:${cardEffectArgs.cardLibrary}:startTurn`,
            listeningFor: 'startTurn',
            condition: (conditionArgs) => {
              if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
              return true;
            },
            once: true,
            compulsory: true,
            allowMultipleInstances: true,
            playerId: eventArgs.playerId,
            triggeredEffectFn: async (triggerEffectArgs) => {
              await triggerEffectArgs.runGameActionDelegate('playCard', {
                playerId: eventArgs.playerId,
                cardId,
                overrides: {
                  actionCost: 0
                }
              })
            }
          })
        }
        else {
          console.log(`[farmhands effect] player chose not to set aside`);
        }
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[farmhands effect] drawing 1 card, and 2 actions`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
    }
  },
  'farrier': {
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
          triggeredEffectFn: async (triggerEffectArgs) => {
            await triggerEffectArgs.runGameActionDelegate('drawCard', {
              playerId: eventArgs.playerId,
              count: overpaid
            }, { loggingContext: { source: eventArgs.cardId } });
          }
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[farrier effect] drawing 1 card, gaining 1 action, and 1 buy`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `farrier:${cardEffectArgs.cardId}:endTurn`,
        listeningFor: 'endTurn',
        playerId: cardEffectArgs.playerId,
        allowMultipleInstances: true,
        once: true,
        compulsory: true,
        condition: (conditionArgs) => true,
        triggeredEffectFn: async (triggerEffectArgs) => {
        
        }
      })
    }
  },
  'ferryman': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const cardIds = cardEffectArgs.findCards(
          [{ location: 'kingdomSupply' }, { tags: 'ferryman' }],
        );
        
        if (!cardIds.length) {
          console.log(`[ferryman effect] no ferryman cards in kingdom, can't gain`);
          return;
        }
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: eventArgs.playerId,
          cardId: cardIds.slice(-1)[0].id,
          to: { location: 'playerDiscard' }
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[ferryman effect] drawing 2 cards, and 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard card`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[ferryman effect] no cards selected`);
        return;
      }
      
      const selectedCardId = selectedCardIds.slice(-1)[0];
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      
      console.log(`[ferryman effect] discarding ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('discardCard', {
        cardId: selectedCardId,
        playerId: cardEffectArgs.playerId
      });
    }
  },
  'footpad': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[footpad effect] gaining 2 coffers`);
      await cardEffectArgs.runGameActionDelegate('gainCoffer', { playerId: cardEffectArgs.playerId, count: 2 });
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerDiscard', targetPlayerId);
        const numToDiscard = hand.length - 3;
        if (numToDiscard <= 0) {
          console.log(`[footpad effect] player ${targetPlayerId} already at 3 or less`);
          continue;
        }
        
        console.log(`[footpad effect] player ${targetPlayerId} discarding ${numToDiscard} cards`);
        
        for (let i = 0; i < numToDiscard; i++) {
          const cardId = hand.slice(-1)[0];
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: cardId,
            playerId: targetPlayerId
          });
        }
      }
    }
  },
  'hamlet': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[hamlet effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      if (hand.length > 0) {
        const result = await cardEffectArgs.runGameActionDelegate('selectCard', {
          prompt: 'Discard to gain action?',
          playerId: cardEffectArgs.playerId,
          optional: true,
          count: 1,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        }) as CardId[];
        
        if (result.length) {
          console.log(`[hamlet effect] player chose to discard to gain +1 action`);
          const cardId = result[0];
          await cardEffectArgs.runGameActionDelegate('discardCard', { cardId, playerId: cardEffectArgs.playerId });
          await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
        }
        else {
          console.log(`[hamlet effect] player chose not to discard to gain +1 action`);
        }
      }
      else {
        console.log(`[hamlet effect] no cards in hand, not prompting to discard for action`);
      }
      
      if (hand.length > 0) {
        const result = await cardEffectArgs.runGameActionDelegate('selectCard', {
          prompt: 'Discard to gain buy?',
          playerId: cardEffectArgs.playerId,
          optional: true,
          count: 1,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        }) as CardId[];
        
        if (result.length) {
          const cardId = result[0];
          await cardEffectArgs.runGameActionDelegate('discardCard', { cardId, playerId: cardEffectArgs.playerId });
          await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
        }
        else {
          console.log(`[hamlet effect] player chose not to discard to gain +1 buy`);
        }
      }
      else {
        console.log(`[hamlet effect] no cards in hand, not prompting to discard for buy`);
      }
    }
  },
  'herald': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `herald:${eventArgs.cardId}:endTurn`,
          playerId: eventArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'endTurn',
          condition: () => true,
          triggeredEffectFn: async (triggerEffectArgs) => {
            const boughtStats = triggerEffectArgs.match.stats.cardsBought[eventArgs.cardId];
            const overpaid = boughtStats.paid - boughtStats.cost;
            if (!eventArgs.bought || overpaid <= 0) {
              console.log(`[herald triggered effect] no overpay cost spent for ${eventArgs.cardId}`);
              return;
            }
            
            console.log(`[herald triggered effect] ${eventArgs.playerId} overpaid for ${eventArgs.cardId}`);
            
            const discardIds = triggerEffectArgs.findCards({ location: 'playerDiscard', playerId: eventArgs.playerId })
              .map(card => card.id);
            
            const numToChoose = Math.min(overpaid, discardIds.length);
            
            const result = await triggerEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: `You may choose up to ${numToChoose} from your discard to top-deck`,
              playerId: eventArgs.playerId,
              actionButtons: [
                { label: 'DONE', action: 1 }
              ],
              content: {
                type: 'select',
                cardIds: discardIds,
                selectCount: {
                  kind: 'upTo',
                  count: numToChoose
                }
              },
              validationAction: 1,
            }) as { action: number, result: CardId[] };
            
            console.log(`[herald triggered effect] putting ${result.result.length} cards on top of deck`);
            
            for (const cardId of result.result) {
              await cardEffectArgs.runGameActionDelegate('moveCard', {
                cardId: cardId,
                toPlayerId: eventArgs.playerId,
                to: { location: 'playerDeck' }
              });
            }
          }
        })
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[herald effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      
      if (deck.length === 0) {
        console.log(`[herald effect] no cards in deck, shuffling`);
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
        
        if (deck.length === 0) {
          console.log(`[herald effect] no cards in deck after shuffling`);
          return;
        }
      }
      
      const cardId = deck.slice(-1)[0];
      const card = cardEffectArgs.cardLibrary.getCard(cardId);
      
      console.log(`[herald effect] player ${cardEffectArgs.playerId} revealing ${card}`);
      
      await cardEffectArgs.runGameActionDelegate('revealCard', {
        cardId,
        playerId: cardEffectArgs.playerId,
      });
      
      if (card.type.includes('ACTION')) {
        console.log(`[herald effect] card is an action card, playing it`);
        await cardEffectArgs.runGameActionDelegate('playCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
        });
      }
    }
  },
  'horn-of-plenty': {
    registerEffects: () => async (cardEffectArgs) => {
      const uniquelyNamesCardsInPlay = new Set(getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => card.owner === cardEffectArgs.playerId)
        .map(card => card.cardName)
      ).size;
      
      console.log(`[horn of plenty effect] gaining ${uniquelyNamesCardsInPlay} treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: uniquelyNamesCardsInPlay });
    }
  },
  'housecarl': {
    registerEffects: () => async (cardEffectArgs) => {
      const uniqueActionCardsInPlay = Array.from(getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => card.type.includes('ACTION'))
        .reduce((map, card) => {
          if (!map.has(card.cardKey)) {
            map.set(card.cardKey, card);
          }
          return map;
        }, new Map<Card['cardKey'], Card>())
        .values());
      
      if (uniqueActionCardsInPlay.length === 0) {
        console.log(`[housecarl effect] no action cards in play`);
        return;
      }
      
      console.log(`[housecarl effect] drawing ${uniqueActionCardsInPlay.length} cards`);
      
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: uniqueActionCardsInPlay.length
      });
    }
  },
  'huge-turnip': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.runGameActionDelegate('gainCoffer', { count: 2, playerId: cardEffectArgs.playerId });
      
      const coffers = cardEffectArgs.match.coffers?.[cardEffectArgs.playerId] ?? 0;
      
      if (coffers === 0) {
        console.log(`[huge turnip effect] no coffers`);
        return;
      }
      
      console.log(`[huge turnip effect] gaining ${coffers} treasure`);
      
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: coffers });
    }
  },
  'hunting-party': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[hunting party effect] drawing 1 card and gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (hand.length === 0) {
        console.warn(`[hunting party effect] no cards in hand`);
        return;
      }
      for (const cardId of hand) {
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: cardId,
          playerId: cardEffectArgs.playerId,
        });
      }
      const uniqueHandCardNames = new Set(hand
        .map(cardEffectArgs.cardLibrary.getCard)
        .map(card => card.cardName)
      );
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      let cardFound = false;
      const cardsToDiscard: CardId[] = [];
      while (deck.length + discard.length > 0 && !cardFound) {
        let cardId = deck.slice(-1)[0];
        
        if (!cardId) {
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          
          if (deck.length < 0) {
            console.warn(`[hunting party effect] no cards in deck after shuffling`);
            return;
          }
        }
        
        cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        if (uniqueHandCardNames.has(card.cardName)) {
          console.log(`[hunting party effect] adding ${card.cardName} to discards`);
          cardsToDiscard.push(cardId);
        }
        else {
          console.log(`[hunting party effect] moving ${card.cardName} to hand`);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' }
          });
          cardFound = true;
        }
      }
      
      console.log(`[hunting party effect] discarding ${cardsToDiscard.length} cards`);
      for (const cardId of cardsToDiscard) {
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: cardId,
          playerId: cardEffectArgs.playerId
        });
      }
    }
  },
  'infirmary': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
        const overpaid = boughtStats.paid - boughtStats.cost;
        if (!eventArgs.bought || overpaid <= 0) {
          console.log(`[infirmary onGained] no overpay cost spent for ${eventArgs.cardId}`);
          return;
        }
        
        console.log(`[infirmary onGained] ${eventArgs.playerId} overpaid for ${eventArgs.cardId}`);
        
        for (let i = 0; i < overpaid; i++) {
          await cardEffectArgs.runGameActionDelegate('playCard', {
            playerId: eventArgs.playerId,
            cardId: eventArgs.cardId
          });
        }
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[infirmary effect] drawing 1 card`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
        optional: true
      }) as CardId[];
      
      if (!selectedCardIds[0]) {
        console.log(`[infirmary effect] no cards selected`);
        return;
      }
      
      const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[infirmary effect] player ${cardEffectArgs.playerId} trashing ${card}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardIds[0],
      });
    }
  },
  'jester': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[jester effect] gaining 2 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId].result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);
        
        if (deck.length === 0) {
          console.log(`[jester effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: targetPlayerId });
          
          if (deck.length === 0) {
            console.log(`[jester effect] no cards in deck after shuffling`);
            continue
          }
        }
        
        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        
        console.log(`[jester effect] player ${targetPlayerId} discarding ${card}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', { cardId: cardId, playerId: targetPlayerId });
        
        if (card.type.includes('VICTORY')) {
          console.log(`[jester effect] card is a victory card, gaining curse`);
          const curseCardIds = cardEffectArgs.findCards(
            [{ location: 'basicSupply' }, { cardKeys: 'curse' }]
          );
          
          if (!curseCardIds.length) {
            console.log(`[jester effect] no curse cards in supply`);
            continue;
          }
          
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: targetPlayerId,
            cardId: curseCardIds.slice(-1)[0].id,
            to: { location: 'basicSupply' }
          });
        }
        else {
          const copyIds = cardEffectArgs.findCards(
            [{ location: ['basicSupply', 'kingdomSupply'] }, { cardKeys: card.cardKey }]
          );
          
          if (!copyIds.length) {
            console.log(`[jester effect] no copies of ${card.cardName} in supply`);
            continue;
          }
          
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: `You or they gain a ${card.cardName}`,
            playerId: cardEffectArgs.playerId,
            actionButtons: [
              { label: 'THEY GAIN', action: 1 },
              { label: 'YOU GAIN', action: 2 },
            ],
          }) as { action: number, result: number[] };
          
          const copyId = copyIds.slice(-1)[0];
          
          if (result.action === 1) {
            console.log(`[jester effect] player ${targetPlayerId} gaining ${card.cardName}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: targetPlayerId,
              cardId: copyId.id,
              to: { location: 'playerDiscard' }
            });
          }
          else {
            console.log(`[jester effect] player ${cardEffectArgs.playerId} gaining ${card.cardName}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: copyId.id,
              to: { location: 'playerDiscard' }
            });
          }
        }
      }
    }
  },
  'journeyman': {
    registerEffects: () => async (cardEffectArgs) => {
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Name a card',
        playerId: cardEffectArgs.playerId,
        content: { type: 'name-card' }
      }) as { action: number, result: CardKey };
      
      const key = result.result;
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      let count = 0;
      while (deck.length + discard.length > 0 && count < 3) {
        if (deck.length === 0) {
          console.warn(`[journeyman effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          
          if (deck.length === 0) {
            console.warn(`[journeyman effect] no cards in deck after shuffling`);
            break;
          }
        }
        
        const cardId = deck.slice(-1)[0];
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true
        });
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        if (card.cardKey === key) {
          await cardEffectArgs.runGameActionDelegate('discardCard', { cardId, playerId: cardEffectArgs.playerId });
        }
        else {
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' }
          });
          count++;
        }
      }
    }
  },
  'joust': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[joust effect] drawing 1 card, and gaining 1 action, and 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const provinceCardsInHand = cardEffectArgs.findCards({
        location: 'playerHand',
        playerId: cardEffectArgs.playerId
      })
        .filter(card => card.cardKey === 'province');
      
      if (provinceCardsInHand.length === 0) {
        console.log(`[joust effect] no province cards in hand`);
        return;
      }
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Set aside province?',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'CANCEL', action: 1 }, { label: 'SET ASIDE', action: 2 }
        ],
      }) as { action: number, result: number[] };
      
      if (result.action === 1) {
        console.log(`[joust effect] player ${cardEffectArgs.playerId} cancelling joust`);
        return;
      }
      
      const provinceCard = provinceCardsInHand.slice(-1)[0];
      
      console.log(`[joust effect] player ${cardEffectArgs.playerId} setting aside ${provinceCard}`);
      
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: provinceCard.id,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'set-aside' }
      });
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `joust:${cardEffectArgs.cardId}:startPhase`,
        listeningFor: 'startTurnPhase',
        condition: (conditionArgs) => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'cleanup') return false;
          return true;
        },
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        triggeredEffectFn: async () => {
          console.log(`[joust triggered effect] player ${cardEffectArgs.playerId} discarding set aside ${provinceCard}`);
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: provinceCard.id,
            playerId: cardEffectArgs.playerId
          });
        }
      });
      
      const rewardCardIds = cardEffectArgs.findCards({ cardType: 'REWARD' });
      
      if (!rewardCardIds.length) {
        console.log(`[joust effect] no reward cards in supply`);
        return;
      }
      
      let selectedRewardId: CardId | undefined = undefined;
      
      if (rewardCardIds.length === 1) {
        selectedRewardId = rewardCardIds[0].id;
      }
      else {
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Select reward`,
          restrict: rewardCardIds.map(card => card.id),
          count: 1
        }) as CardId[];
        
        selectedRewardId = selectedCardIds[0];
      }
      
      if (!selectedRewardId) {
        console.warn(`[joust effect] no reward card selected`);
        return;
      }
      
      const selectedRewardCard = cardEffectArgs.cardLibrary.getCard(selectedRewardId);
      
      console.log(`[joust effect] player ${cardEffectArgs.playerId} gaining ${selectedRewardCard}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedRewardId,
        to: { location: 'playerHand' }
      });
    }
  },
  'menagerie': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[menagerie effect] gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      console.log(`[menagerie effect] revealing ${hand.length} cards`);
      
      for (const cardId of hand) {
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: cardId,
          playerId: cardEffectArgs.playerId,
        });
      }
      
      const uniqueHandCardNames = new Set(hand
        .map(cardEffectArgs.cardLibrary.getCard)
        .map(card => card.cardName)
      );
      
      if (uniqueHandCardNames.size === hand.length) {
        console.log(`[menagerie effect] all cards in hand are unique, gaining 3 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });
      }
      else {
        console.log(`[menagerie effect] not all cards in hand are unique, gaining 1 card`);
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      }
    }
  },
  'merchant-guild': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[merchant guild effect] gaining 1 buy, and 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `merchant-guild:${cardEffectArgs.cardId}:endTurnPhase`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'endTurnPhase',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) === 'buy') return false;
          return true;
        },
        triggeredEffectFn: async (triggerEffectArgs) => {
          const turnBought = triggerEffectArgs.match.stats.cardsGained[cardEffectArgs.cardId].turnNumber;
          const cardIdsGained = triggerEffectArgs.match.stats.cardsGainedByTurn[turnBought];
          const cardsGained = cardIdsGained.map(triggerEffectArgs.cardLibrary.getCard);
          const ownGained = cardsGained.filter(card => card.owner === cardEffectArgs.playerId);
          
          console.log(`[merchant guild triggered effect] gaining ${ownGained.length} coffers`);
          
          await cardEffectArgs.runGameActionDelegate('gainCoffer', {
            playerId: cardEffectArgs.playerId,
            count: ownGained.length
          }, { loggingContext: { source: cardEffectArgs.cardId } });
        }
      })
    }
  },
  'plaza': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[plaza effect] drawing 1 card, and gaining 2 actions`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard treasure`,
        restrict: [
          { location: 'playerHand', playerId: cardEffectArgs.playerId },
          { cardType: 'TREASURE' }
        ],
        count: 1,
        optional: true,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[plaza effect] no cards selected`);
        return;
      }
      
      const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      console.log(`[plaza effect] player ${cardEffectArgs.playerId} discarding ${card}`);
      
      await cardEffectArgs.runGameActionDelegate('discardCard', {
        cardId: selectedCardIds[0],
        playerId: cardEffectArgs.playerId
      });
      
      await cardEffectArgs.runGameActionDelegate('gainCoffer', { playerId: cardEffectArgs.playerId, count: 1 });
    }
  },
  'remake': {
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const count = Math.min(2, hand.length);
      console.log(`[remake effect] selecting ${count} cards`);
      
      for (let i = 0; i < count; i++) {
        let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: hand,
          count: 1,
        }) as CardId[];
        
        const selectedId = selectedCardIds[0];
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedId);
        
        console.log(`[remake effect] player ${cardEffectArgs.playerId} trashing ${selectedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedId,
        });
        
        const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
          playerId: cardEffectArgs.playerId
        });
        
        const availableCardIds = cardEffectArgs.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          {
            kind: 'exact',
            playerId: cardEffectArgs.playerId,
            amount: { ...cost, treasure: cost.treasure + 1 }
          }
        ]);
        
        if (!availableCardIds.length) {
          console.log(`[remake effect] no cards in supply with cost ${cost}`);
          continue;
        }
        
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: availableCardIds.map(card => card.id),
          count: 1
        }) as CardId[];
        
        const selectedCardId = selectedCardIds[0];
        
        if (!selectedCardId) {
          console.warn(`[remake effect] no card selected`);
          continue;
        }
        
        const card = cardEffectArgs.cardLibrary.getCard(availableCardIds.slice(-1)[0].id);
        
        console.log(`[remake effect] player ${cardEffectArgs.playerId} gaining ${card}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: availableCardIds.slice(-1)[0].id,
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'renown': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      const rule: CardPriceRule = (card, context) => {
        return {
          restricted: false,
          cost: {
            treasure: -2,
            potion: card.cost.potion,
          }
        }
      }
      
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
          console.log(`[renown triggered effect] removing price rule`);
          for (const unsub of ruleSubs) {
            unsub();
          }
        }
      })
    }
  },
  'shop': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[shop effect] drawing 1 card, and gaining 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const cardsInPlay = getCardsInPlay(cardEffectArgs.findCards);
      
      const uniqueInPlayCardNames = new Set(cardsInPlay
        .map(card => card.cardName)
      );
      
      const cardsInHand = cardEffectArgs.findCards({ location: 'playerHand', playerId: cardEffectArgs.playerId })
        .filter(card => !uniqueInPlayCardNames.has(card.cardKey) && card.type.includes('ACTION'));
      
      if (cardsInHand.length === 0) {
        console.log(`[shop effect] no action cards in hand that are not in play`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play card?`,
        restrict: cardsInHand.map(card => card.id),
        count: 1,
        optional: true,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[shop effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0])
      console.log(`[shop effect] player ${cardEffectArgs.playerId} playing ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardIds[0]
      });
    }
  },
  'soothsayer': {
    registerEffects: () => async (cardEffectArgs) => {
      const goldCardIds = cardEffectArgs.findCards(
        [{ location: 'basicSupply' }, { cardKeys: 'gold' }]
      );
      
      if (!goldCardIds.length) {
        console.log(`[soothsayer effect] no gold cards in supply`);
      }
      else {
        console.log(`[soothsayer effect] player ${cardEffectArgs.playerId} gaining gold`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: goldCardIds.slice(-1)[0].id,
          to: { location: 'playerDiscard' }
        });
      }
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const curseCardIds = cardEffectArgs.findCards(
          [{ location: 'basicSupply' }, { cardKeys: 'curse' }]
        );
        
        if (!curseCardIds.length) {
          console.log(`[soothsayer effect] no curse cards in supply`);
          continue;
        }
        
        console.log(`[soothsayer effect] player ${targetPlayerId} gaining a curse`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: targetPlayerId,
          cardId: curseCardIds.slice(-1)[0].id,
          to: { location: 'playerDiscard' }
        });
        
        console.log(`[soothsayer effect] player ${targetPlayerId} drawing 1 card`);
        
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: targetPlayerId });
      }
    }
  },
  'stonemason': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
        const overpaid = boughtStats.paid - boughtStats.cost;
        if (!eventArgs.bought || overpaid <= 0) {
          console.log(`[stonemason triggered effect] ${eventArgs.cardId} was not overpaid, skipping`);
          return;
        }
        
        const cardIds = cardEffectArgs.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          { cardType: 'ACTION' },
          {
            playerId: eventArgs.playerId, kind: 'exact', amount: { treasure: overpaid }
          }
        ]);
        
        if (!cardIds.length) {
          console.log(`[stonemason triggered effect] no cards in supply with cost ${overpaid}`);
          return;
        }
        
        const numToGain = Math.min(2, cardIds.length);
        
        console.log(`[stonemason triggered effect] gaining ${numToGain} cards`);
        
        for (let i = 0; i < numToGain; i++) {
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: eventArgs.playerId,
            prompt: `Gain card`,
            restrict: cardIds.map(card => card.id),
            count: 1,
          });
          
          if (!selectedCardIds.length) {
            console.warn(`[stonemason triggered effect] no card selected`);
            continue;
          }
          
          const selectedCardId = selectedCardIds[0];
          const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);
          
          console.log(`[stonemason triggered effect] player ${eventArgs.playerId} gaining ${card}`);
          
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: selectedCardId,
            to: { location: 'playerDiscard' }
          });
        }
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      if (hand.length === 0) {
        console.log(`[stonemason effect] no cards in hand`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: hand,
        count: 1
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[stonemason effect] no card selected`);
        return;
      }
      
      const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[stonemason effect] player ${cardEffectArgs.playerId} trashing ${card}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardIds[0],
      });
      
      const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
        playerId: cardEffectArgs.playerId
      });
      
      const cardIds = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        {
          kind: 'upTo',
          playerId: cardEffectArgs.playerId,
          amount: {
            treasure: cost.treasure - 1,
            potion: 1
          }
        }
      ]);
      
      if (!cardIds.length) {
        console.log(`[stonemason effect] no cards in supply with cost ${cost} or less to gain`);
        return;
      }
      
      const numToGain = Math.min(2, cardIds.length);
      
      console.log(`[stonemason effect] player ${cardEffectArgs.playerId} gaining ${numToGain} cards`);
      
      for (let i = 0; i < numToGain; i++) {
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cardIds.map(card => card.id),
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[stonemason effect] no card selected`);
          continue;
        }
        
        const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[stonemason effect] player ${cardEffectArgs.playerId} gaining ${card}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardIds[0],
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'young-witch': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[young witch effect] drawing 2 cards`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const count = Math.min(2, hand.length);
      
      console.log(`[young witch effect] selecting ${count} cards`);
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[young witch effect] no cards selected`);
      }
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const handIds = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        const handCards = handIds.map(cardId => cardEffectArgs.cardLibrary.getCard(cardId));
        const baneCards = handCards.filter(card => card.tags?.includes('bane'));
        
        const curseCardIds = cardEffectArgs.findCards(
          [{ location: 'basicSupply' }, { cardKeys: 'curse' }]
        );
        
        if (!curseCardIds.length) {
          console.log(`[young witch effect] no curse cards in supply`);
          return;
        }
        
        let reveal = false;
        
        if (baneCards.length > 0) {
          console.log(`[young witch effect] player ${targetPlayerId} has a bane, asking to reveal`);
          const baneCard = baneCards[0];
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: `Reveal ${baneCard.cardName}`,
            playerId: targetPlayerId,
            actionButtons: [
              { label: 'Cancel', action: 1 },
              { label: 'Reveal', action: 2 }
            ],
          }) as { action: number, result: number[] };
          
          reveal = result.action === 2;
          
          if (result.action === 2) {
            console.log(`[young witch effect] player ${targetPlayerId} revealed a bane`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: baneCard.id,
              playerId: targetPlayerId,
            });
          }
        }
        else {
          reveal = false;
        }
        
        if (!reveal) {
          console.log(`[young witch effect] player ${targetPlayerId} did not reveal a bane`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: targetPlayerId,
            cardId: curseCardIds[0].id,
            to: { location: 'playerDiscard' }
          });
        }
      }
    }
  },
}

export default expansion;
