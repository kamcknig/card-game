import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { CardExpansionModule } from '../../types.ts';
import { ActionButtons, Card, CardId, CardKey, PlayerId } from 'shared/shared-types.ts';

const expansionModule: CardExpansionModule = {
  'baron': {
    registerEffects: () => async ({ runGameActionDelegate, cardLibrary, match, playerId }) => {
      // +1 Buy
      // You may discard an Estate for +$4. If you don't, gain an Estate.
      
      console.log(`[BARON EFFECT] gaining 1 buy...`);
      
      await runGameActionDelegate('gainBuy', {
        count: 1,
      });
      
      const hand = match.playerHands[playerId];
      
      const handEstateIdx = hand.findLast((cId) =>
        cardLibrary.getCard(cId).cardKey === 'estate'
      );
      
      const supplyEstateIdx = match.basicSupply.findLast((cId) =>
        cardLibrary.getCard(cId).cardKey === 'estate'
      );
      
      if (!handEstateIdx) {
        console.log(`[BARON EFFECT] player has no estates in hand, they gain one`);
        
        if (!supplyEstateIdx) {
          console.log(`[BARON EFFECT] no estates in supply`);
          return;
        }
      }
      else {
        console.log(`[BARON EFFECT] player has an estate in hand`);
        
        const confirm = await runGameActionDelegate('userPrompt', {
          playerId,
          prompt: 'Discard estate?',
          actionButtons: [
            { label: `DON'T DISCARD`, action: 1 },
            { label: 'DISCARD', action: 2 },
          ],
        }) as { action: number };
        
        if (confirm.action === 2) {
          console.log(`[BARON EFFECT] player chooses to discard estate, gain 4 treasure`);
          
          await runGameActionDelegate('discardCard', {
            cardId: handEstateIdx,
            playerId,
          });
          
          await runGameActionDelegate('gainTreasure', {
            count: 4,
          });
          
          return
        }
      }
      
      if (!supplyEstateIdx) {
        console.log(`[BARON EFFECT] no estate in supply`);
        return;
      }
      
      console.log(`[BARON EFFECT] player not discarding estate, gain ${cardLibrary.getCard(supplyEstateIdx)}...`);
      
      await runGameActionDelegate('gainCard', {
        playerId,
        cardId: supplyEstateIdx,
        to: { location: 'playerDiscards' },
      });
    }
  },
  'bridge': {
    registerEffects: () => async ({
      reactionManager,
      cardLibrary,
      runGameActionDelegate,
      cardPriceController,
      cardId,
      playerId
    }) => {
      console.log(`[BRIDGE EFFECT] gaining 1 buy...`);
      
      await runGameActionDelegate('gainBuy', { count: 1 });
      
      console.log(`[BRIDGE EFFECT] gaining 1 treasure...`);
      
      await runGameActionDelegate('gainTreasure', {
        count: 1,
      });
      
      console.log(`[BRIDGE EFFECT] modify cost by -1 of all cards...`);
      
      const allCards = cardLibrary.getAllCardsAsArray();
      const ruleCleanups: (() => void)[] = [];
      for (const card of allCards) {
        ruleCleanups.push(
          cardPriceController.registerRule(
            card,
            (card, context) => {
              return { restricted: false, cost: { treasure: -1 } }
            }
          )
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
        compulsory: true
      });
    }
  },
  'conspirator': {
    registerEffects: () => async ({ match, cardLibrary, playerId, runGameActionDelegate }) => {
      console.log(`[CONSPIRATOR EFFECT] gaining 2 treasure...`);
      
      await runGameActionDelegate('gainTreasure', { count: 2 });
      
      // we want those cards played on the player's turn that are actions and played by THAT player
      const actionCardCount =
        Object.keys(match.stats.playedCards)
          .filter(cardId =>
            cardLibrary.getCard(+cardId).type.includes('ACTION')
            && match.stats.playedCards[+cardId].playerId === playerId);
      
      console.log(`[CONSPIRATOR EFFECT] action cards played so far ${actionCardCount.length}`);
      
      if (actionCardCount?.length >= 3) {
        console.log(`[CONSPIRATOR EFFECT] drawing card...`);
        
        await runGameActionDelegate('drawCard', { playerId });
        
        console.log(`[CONSPIRATOR EFFECT] gaining 1 action...`);
        
        await runGameActionDelegate('gainAction', {
          count: 1,
        });
      }
    }
  },
  'courtier': {
    registerEffects: () => async ({ match, playerId, cardLibrary, runGameActionDelegate }) => {
      const hand = match.playerHands[playerId];
      
      if (!hand.length) {
        console.log(`[COURTIER EFFECT] no cards in hand`);
        return;
      }
      
      console.log(`[COURTIER EFFECT] prompting user to reveal a card...`);
      
      const cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Reveal card',
        count: 1,
        playerId,
        restrict: {
          from: { location: 'playerHands' },
        },
      }) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[COURTIER EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
      
      await runGameActionDelegate('revealCard', {
        cardId,
        playerId,
      });
      
      let cardTypeCount = cardLibrary.getCard(cardId).type.length;
      
      console.log(`[COURTIER EFFECT] card has ${cardTypeCount} types`);
      
      cardTypeCount = Math.min(cardTypeCount, 4);
      
      console.log(`[COURTIER EFFECT] final choice count ${cardTypeCount}`);
      
      const choices = [
        { label: '+1 Action', action: 1 },
        { label: '+1 Buy', action: 2 },
        { label: '+3 Treasure', action: 3 },
        { label: 'Gain a gold', action: 4 },
      ];
      
      for (let i = 0; i < cardTypeCount; i++) {
        console.log(`[COURTIER EFFECT] prompting user to select an action...`);
        
        const result = await runGameActionDelegate('userPrompt', {
          playerId,
          prompt: 'Choose one',
          actionButtons: choices,
        }) as { action: number };
        
        const resultAction = result.action;
        
        console.log(`[COURTIER EFFECT] player chose '${choices.find(c => c.action === resultAction)?.label}'`);
        
        const idx = choices.findIndex((c) => c.action === resultAction);
        choices.splice(idx, 1);
        
        switch (resultAction) {
          case 1:
            console.log(`[COURTIER EFFECT] gaining 1 action...`);
            await runGameActionDelegate('gainAction', {
              count: 1,
            });
            break;
          case 2:
            console.log(`[COURTIER EFFECT] gaining 1 buy...`);
            await runGameActionDelegate('gainBuy', {
              count: 1,
            });
            break;
          case 3:
            console.log(`[COURTIER EFFECT] gaining 1 treasure...`);
            await runGameActionDelegate('gainTreasure', {
              count: 3,
            });
            break;
          case 4: {
            const goldCardId = match.basicSupply.find(cardId => cardLibrary.getCard(cardId).cardKey === 'gold');
            
            if (!goldCardId) {
              console.log(`[COURTIER EFFECT] no gold in supply...`);
              break;
            }
            
            console.log(`[COURTIER EFFECT] gaining ${cardLibrary.getCard(goldCardId)}...`);
            await runGameActionDelegate('gainCard', {
              cardId: goldCardId,
              playerId,
              to: {
                location: 'playerDiscards',
              },
            });
            break;
          }
        }
      }
    }
  },
  'courtyard': {
    registerEffects: () => async ({ match, runGameActionDelegate, playerId, cardLibrary }) => {
      console.log(`[COURTYARD EFFECT] drawing 3 cards...`);
      
      await runGameActionDelegate('drawCard', { playerId, count: 3 });
      
      const hand = match.playerHands[playerId];
      
      if (!hand.length) {
        console.log(`[COURTYARD EFFECT] no cards in hand`);
        return;
      }
      
      console.log(`[COURTYARD EFFECT] prompting user to put card onto deck...`);
      
      const result = await runGameActionDelegate('selectCard', {
        prompt: 'Top deck',
        count: 1,
        playerId,
        restrict: {
          from: { location: 'playerHands' },
        },
      }) as number[];
      
      const cardId = result[0];
      
      console.log(`[COURTYARD EFFECT] moving ${cardLibrary.getCard(cardId)} to top of deck...`);
      
      await runGameActionDelegate('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: { location: 'playerDecks' },
      });
    }
  },
  'diplomat': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ reactionManager, runGameActionDelegate }, { playerId, cardId }) => {
        reactionManager.registerReactionTemplate({
          id: `diplomat:${cardId}:cardPlayed`,
          playerId,
          listeningFor: 'cardPlayed',
          condition: ({ match, trigger, cardLibrary }) => {
            return cardLibrary.getCard(trigger.args.cardId!).type.includes('ATTACK') &&
              match.playerHands[playerId].length >= 5 &&
              trigger.args.playerId !== playerId
          },
          triggeredEffectFn: async function ({ reaction, cardLibrary }) {
            const sourceId = reaction.getSourceId();
            
            console.log(`[diplomat triggered effect] running for ${cardLibrary.getCard(cardId)}`);
            
            await runGameActionDelegate('revealCard', {
              cardId: sourceId,
              playerId: reaction.playerId,
            });
            
            await runGameActionDelegate('drawCard', { playerId });
            await runGameActionDelegate('drawCard', { playerId });
            const cardIds = await runGameActionDelegate('selectCard', {
              prompt: 'Confirm discard',
              playerId,
              restrict: {
                from: { location: 'playerHands' },
              },
              count: 3,
            }) as number[];
            
            for (const cardId of cardIds) {
              await runGameActionDelegate('discardCard', {
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
    registerEffects: () => async ({ match, runGameActionDelegate, playerId }) => {
      console.log(`[DIPLOMAT EFFECT] drawing 2 cards...`);
      
      await runGameActionDelegate('drawCard', { playerId, count: 2 });
      
      const cardCount = match.playerHands[playerId].length;
      if (cardCount <= 5) {
        console.log(`[DIPLOMAT EFFECT] gaining 2 actions...`);
        
        await runGameActionDelegate('gainAction', {
          count: 2,
        });
      }
      else {
        console.log(`[DIPLOMAT EFFECT] player has more than ${cardCount} cards in hand, can't perform diplomat`,);
      }
    }
  },
  'duke': {
    registerScoringFunction: () => ({ match, cardLibrary, ownerId }) => {
      const duchies = match.playerHands[ownerId]?.concat(
        match.playerDecks[ownerId],
        match.playerDiscards[ownerId],
        match.playArea,
      ).map(cardLibrary.getCard)
        .filter((card) => card.cardKey === 'duchy');
      
      console.log(`[DUKE SCORING] player ${getPlayerById(match, ownerId)} has ${duchies.length} Duchies`);
      
      return duchies.length;
    },
    registerEffects: () => async () => {
      console.log(`[DUKE EFFECT] duke has no effects`);
    }
  },
  'farm': {
    registerEffects: () => async ({ runGameActionDelegate }) => {
      console.log(`[FARM EFFECT] gaining 2 treasure...`);
      
      await runGameActionDelegate('gainTreasure', {
        count: 2,
      });
    }
  },
  'ironworks': {
    registerEffects: () => async ({ cardLibrary, runGameActionDelegate, playerId }) => {
      console.log(`[IRONWORKS EFFECT] prompting user to choose card costing up to 4...`);
      
      const cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Choose card',
        count: 1,
        restrict: {
          cost: { playerId, amount: { treasure: 4 }, kind: 'upTo' },
          from: { location: ['supply', 'kingdom'] },
        },
        playerId,
      }) as number[];
      
      console.log(`[IRONWORKS EFFECT] gaining ${cardLibrary.getCard(cardIds[0])}...`);
      
      await runGameActionDelegate('gainCard', {
        cardId: cardIds[0],
        playerId,
        to: { location: 'playerDiscards' },
      });
      
      const card = cardLibrary.getCard(cardIds[0]);
      
      if (card.type.includes('ACTION')) {
        console.log(`[IRONWORKS EFFECT] card is an action, gaining 1 action...`);
        
        await runGameActionDelegate('gainAction', {
          count: 1,
        });
      }
      
      if (card.type.includes('TREASURE')) {
        console.log(`[IRONWORKS EFFECT] card is a treasure, gaining 1 treasure...`);
        
        await runGameActionDelegate('gainTreasure', {
          count: 1,
        });
      }
      
      if (card.type.includes('VICTORY')) {
        console.log(`[IRONWORKS EFFECT] card is a victory, drawing card...`);
        
        await runGameActionDelegate('drawCard', { playerId });
      }
    }
  },
  'lurker': {
    registerEffects: () => async ({ cardLibrary, match, playerId, runGameActionDelegate }) => {
      console.log(`[LURKER EFFECT] gaining 1 action...`);
      
      await runGameActionDelegate('gainAction', { count: 1 });
      
      let result = { action: 1 };
      
      const actionButtons: ActionButtons = [
        { action: 1, label: 'TRASH CARD' },
        { action: 2, label: 'GAIN CARD' }
      ];
      
      result = await runGameActionDelegate('userPrompt', {
        playerId,
        prompt: 'Trash Action card from supply, or gain Action card from trash?',
        actionButtons,
      }) as { action: number };
      
      console.log(`[LURKER EFFECT] user choose action ${actionButtons.find((a) => a.action === result.action)?.label}`);
      
      if (result.action === 1) {
        console.log(`[LURKER EFFECT] prompting user to select card to trash...`);
        
        const result = await runGameActionDelegate('selectCard', {
          prompt: 'Confirm trash',
          playerId,
          count: 1,
          restrict: {
            card: { type: 'ACTION' },
            from: { location: ['kingdom', 'supply'] },
          },
        }) as number[];
        
        const cardId = result[0];
        
        console.log(`[LURKER EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('trashCard', {
          cardId,
          playerId,
        });
        
        return;
      }
      
      const actionCardIds = match.trash.filter(cardId => cardLibrary.getCard(cardId).type.includes('ACTION'));
      
      if (!actionCardIds.length) {
        console.log(`[LURKER EFFECT] trash has no action cards`);
        return;
      }
      
      if (!match.trash.some(cId => cardLibrary.getCard(cId).type.includes('ACTION'))) {
        console.log(`[LURKER EFFECT] no action cards in trash, skipping gaining`);
        return;
      }
      
      let cardId: CardId;
      if (match.trash.length === 1) {
        console.log(`[LURKER EFFECT] only one card in trash, gaining automatically`);
        cardId = match.trash[0];
      }
      else {
        console.log(`[LURKER EFFECT] prompting user to select action card to gain...`);
        
        const chooseCardResult = await runGameActionDelegate('userPrompt', {
          prompt: 'Choose card to gain',
          playerId,
          content: {
            type: 'select',
            selectCount: 1,
            cardIds: actionCardIds,
          },
        }) as { result: number[] };
        
        cardId = chooseCardResult.result[0];
      }
      
      console.log(`[LURKER EFFECT] gaining ${cardLibrary.getCard(cardId)}...`);
      
      await runGameActionDelegate('gainCard', {
        cardId,
        playerId,
        to: { location: 'playerDiscards' },
      });
    }
  },
  'masquerade': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, cardLibrary }) => {
      console.log(`[masquerade effect] drawing 2 cards...`);
      
      await runGameActionDelegate('drawCard', { playerId, count: 2 });
      
      const targets = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL',
        match
      }).filter((playerId) => match.playerHands[playerId].length > 0);
      
      console.log(`[masquerade effect] targets in order ${targets.map(t => getPlayerById(match, t)).join(',')}`);
      
      const playerCardMap = new Map<PlayerId, CardId>();
      
      for (const playerId of targets) {
        console.log(`[masquerade effect] prompting ${getPlayerById(match, playerId)} to choose a card...`);
        
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Confirm pass',
          playerId,
          count: 1,
          restrict: {
            from: { location: 'playerHands' },
          },
        }) as number[];
        
        playerCardMap.set(playerId, cardIds[0]);
        
        console.log(`[masquerade effect] ${getPlayerById(match, playerId)} chose ${cardLibrary.getCard(cardIds[0])}`);
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
        
        console.log(`[masquerade effect] moving ${cardLibrary.getCard(cardId!)} to ${getPlayerById(match, playerId!)}`);
        
        await runGameActionDelegate('moveCard', {
          cardId: cardId!,
          toPlayerId: playerId!,
          to: { location: 'playerHands' },
        });
      }
      
      console.log(`[masquerade effect] prompting user to trash card from hand...`);
      
      const cardIds = await runGameActionDelegate('selectCard', {
        optional: true,
        prompt: 'Confirm trash',
        count: 1,
        playerId,
        restrict: {
          from: { location: 'playerHands' },
        },
      }) as number[];
      
      console.log(`[masquerade effect] player chose ${cardIds.length ? cardLibrary.getCard(cardIds[0]) : 'not to trash'}`);
      
      if (cardIds[0]) {
        console.log(`[masquerade effect] trashing ${cardLibrary.getCard(cardIds[0])}...`);
        
        await runGameActionDelegate('trashCard', {
          cardId: cardIds[0],
          playerId,
        });
      }
    }
  },
  'mill': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, cardLibrary }) => {
      console.log(`[MILL EFFECT] drawing card...`);
      
      await runGameActionDelegate('drawCard', { playerId });
      
      console.log(`[MILL EFFECT] gaining 1 action...`);
      
      await runGameActionDelegate('gainAction', { count: 1 });
      
      if (match.playerHands[playerId].length === 0) {
        console.log(`[MILL EFFECT] player has no cards in hand`);
        return;
      }
      
      console.log(`[MILL EFFECT] prompting user to select cards to discard`);
      
      const results = await runGameActionDelegate('selectCard', {
        optional: true,
        prompt: 'Confirm discard',
        playerId,
        restrict: {
          from: { location: 'playerHands' },
        },
        count: Math.min(2, match.playerHands[playerId].length),
      }) as number[];
      
      for (const cardId of results) {
        console.log(`[MILL EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('discardCard', {
          cardId,
          playerId,
        });
      }
      
      console.log(`[MILL EFFECT] gaining 2 treasure...`);
      
      if (results.length == 2) {
        await runGameActionDelegate('gainTreasure', {
          count: 2,
        });
      }
    }
  },
  'mining-village': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, cardId, cardLibrary }) => {
      console.log(`[MINING VILLAGE EFFECT] drawing card...`);
      
      await runGameActionDelegate('drawCard', { playerId });
      
      console.log(`[MINING VILLAGE EFFECT] gaining 2 actions`);
      
      await runGameActionDelegate('gainAction', { count: 2 });
      
      console.log(`[MINING VILLAGE EFFECT] prompting user to trash mining village or not`);
      const results = await runGameActionDelegate('userPrompt', {
        playerId,
        actionButtons: [
          { action: 1, label: `DON'T TRASH` },
          { action: 2, label: 'TRASH' },
        ],
        prompt: 'Trash Mining Village?',
      }) as { action: number };
      
      if (results.action === 2) {
        console.log(`[MINING VILLAGE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId,
        });
        
        console.log(`[MINING VILLAGE EFFECT] gaining 2 treasure...`);
        
        await runGameActionDelegate('gainTreasure', {
          count: 2,
        });
      }
      else {
        console.log(`[MINING VILLAGE EFFECT] player chose not to trash mining village`);
      }
    }
  },
  'minion': {
    registerEffects: () => async ({ match, reactionContext, cardLibrary, runGameActionDelegate, playerId }) => {
      console.log(`[MINION EFFECT] gaining 1 action...`);
      
      await runGameActionDelegate('gainAction', { count: 1 });
      
      console.log(`[MINION EFFECT] prompting user to gain treasure or discard hand...`);
      
      const results = await runGameActionDelegate('userPrompt', {
        playerId,
        actionButtons: [
          { action: 1, label: '+2 Treasure' },
          { action: 2, label: 'Discard hand' },
        ],
      }) as { action: number };
      
      if (results.action === 1) {
        console.log(`[MINION EFFECT] gaining 2 treasure...`);
        
        await runGameActionDelegate('gainTreasure', {
          count: 2,
        });
      }
      else {
        const targets = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL',
          match
        }).filter((playerId) => {
          const handCount = match.playerHands[playerId].length;
          return playerId === playerId ||
            (handCount >= 5 && reactionContext?.[playerId]?.result !== 'immunity');
        });
        
        for (const playerId of targets) {
          const player = getPlayerById(match, playerId);
          const hand = match.playerHands[playerId];
          const l = hand.length;
          for (let i = l - 1; i >= 0; i--) {
            const cardId = hand[i];
            
            console.log(`[MINION EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);
            
            await runGameActionDelegate('discardCard', {
              cardId,
              playerId,
            });
          }
          
          console.log(`[MINION EFFECT] ${player} drawing 4 cards...`);
          
          await runGameActionDelegate('drawCard', { playerId, count: 4 });
        }
      }
    }
  },
  'nobles': {
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      console.log(`[NOBLES EFFECT] prompting user to select actions or treasure`);
      
      const result = await runGameActionDelegate('userPrompt', {
        playerId,
        actionButtons: [
          { action: 1, label: '+3 Cards' },
          { action: 2, label: '+2 Actions' },
        ],
        prompt: 'Choose one',
      }) as { action: number };
      
      console.log(`[NOBLES EFFECT] player chose ${result.action}`);
      
      if (result.action === 1) {
        console.log(`[NOBLES EFFECT] drawing 3 cards...`);
        
        await runGameActionDelegate('drawCard', { playerId, count: 3 });
      }
      else {
        console.log(`[NOBLES EFFECT] gaining 2 actions`);
        await runGameActionDelegate('gainAction', {
          count: 2,
        });
      }
    }
  },
  'patrol': {
    registerEffects: () => async ({ runGameActionDelegate, match, playerId, cardLibrary }) => {
      console.log(`[PATROL EFFECT] drawing 3 cards`);
      
      await runGameActionDelegate('drawCard', { playerId, count: 3 });
      
      const deck = match.playerDecks[playerId];
      const discard = match.playerDiscards[playerId];
      
      console.log(`[PATROL EFFECT] original num to reveal 4`);
      
      const numToReveal = Math.min(4, deck.length + discard.length);
      
      console.log(`[PATROL EFFECT] final num to reveal ${numToReveal}`);
      
      if (numToReveal === 0) {
        console.log(`[PATROL EFFECT] no cards to reveal`);
        return;
      }
      
      if (deck.length < numToReveal) {
        console.log(`[PATROL EFFECT] not enough cards in deck, shuffling`);
        await runGameActionDelegate('shuffleDeck', {
          playerId
        });
      }
      
      const revealedCardIds: number[] = match.playerDecks[playerId].slice(-numToReveal);
      
      for (const cardId of revealedCardIds) {
        console.log(`[PATROL EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('revealCard', {
          cardId,
          playerId,
          moveToSetAside: true,
        });
      }
      
      const [victoryCards, nonVictoryCards] = revealedCardIds
        .map(cardLibrary.getCard)
        .reduce((prev, card) => {
          if (card.type.includes('VICTORY') || card.cardKey === 'curse') {
            prev[0].push(card);
          }
          else {
            prev[1].push(card);
          }
          return prev;
        }, [[], []] as Card[][]);
      
      for (const card of victoryCards) {
        console.log(`[PATROL EFFECT] moving ${card} to hand...`);
        
        await runGameActionDelegate('moveCard', {
          cardId: card.id,
          toPlayerId: playerId,
          to: { location: 'playerHands' },
        });
      }
      
      if (nonVictoryCards.length < 2) {
        if (nonVictoryCards.length === 1) {
          console.log(`[PATROL EFFECT] non-victory card count is ${nonVictoryCards.length}, no need to rearrange`);
          await runGameActionDelegate('moveCard', {
            cardId: nonVictoryCards[0].id,
            to: { location: 'playerDecks' }
          })
        }
        
        return;
      }
      
      console.log(`[PATROL EFFECT] prompting user to rearrange cards...`);
      
      const result = await runGameActionDelegate('userPrompt', {
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
        console.log(`[PATROL EFFECT] top-decking ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerDecks' },
        });
      }
    }
  },
  'pawn': {
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      const actions = [
        { action: 1, label: '+1 Card' },
        { action: 2, label: '+1 Action' },
        { action: 3, label: '+1 Buy' },
        { action: 4, label: '+1 Treasure' },
      ];
      
      for (let i = 0; i < 2; i++) {
        console.log(`[PAWN EFFECT] prompting user to choose...`);
        
        const result = await runGameActionDelegate('userPrompt', {
          playerId,
          actionButtons: actions,
          prompt: 'Choose one',
        }) as { action: number };
        
        switch (result.action) {
          case 1:
            console.log(`[PAWN EFFECT] drawing card...`);
            await runGameActionDelegate('drawCard', { playerId });
            break;
          case 2:
            console.log(`[PAWN EFFECT] gaining 1 action...`);
            await runGameActionDelegate('gainAction', {
              count: 1,
            });
            break;
          case 3:
            console.log(`[PAWN EFFECT] gaining 1 buy...`);
            await runGameActionDelegate('gainBuy', {
              count: 1,
            });
            break;
          case 4:
            console.log(`[PAWN EFFECT] gaining 1 treasure...`);
            await runGameActionDelegate('gainTreasure', {
              count: 1,
            });
            break;
        }
        
        actions.splice(actions.findIndex((a) => a.action === result.action), 1);
      }
    }
  },
  'replace': {
    registerEffects: () => async ({
      runGameActionDelegate,
      match,
      cardLibrary,
      playerId,
      reactionContext,
      cardPriceController
    }) => {
      if (match.playerHands[playerId].length === 0) {
        console.log(`[REPLACE EFFECT] no cards in hand to trash...`);
        return;
      }
      
      console.log(`[REPLACE EFFECT] prompting user to trash card...`);
      
      let result = await runGameActionDelegate('selectCard', {
        prompt: 'Trash card',
        playerId,
        restrict: {
          from: { location: 'playerHands' },
        },
        count: 1,
      }) as number[];
      
      let cardId = result[0];
      let card = cardLibrary.getCard(cardId);
      
      console.log(`[REPLACE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
      
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId,
      });
      
      const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });
      
      console.log(`[REPLACE EFFECT] prompting user to gain a card costing up to ${cardCost.treasure + 2}...`);
      
      result = await runGameActionDelegate('selectCard', {
        prompt: 'Gain card',
        playerId,
        restrict: {
          from: { location: ['kingdom', 'supply'] },
          cost: { playerId, kind: 'upTo', amount: { treasure: cardCost.treasure + 2, potion: cardCost.potion } },
        },
        count: 1,
      }) as number[];
      
      cardId = result[0];
      card = cardLibrary.getCard(cardId);
      
      const location = card.type.some((t) => ['ACTION', 'TREASURE'].includes(t))
        ? 'playerDecks'
        : 'playerDiscards';
      
      console.log(`[REPLACE EFFECT] gaining ${cardLibrary.getCard(cardId)} to ${location}...`);
      
      await runGameActionDelegate('gainCard', {
        playerId,
        cardId,
        to: { location },
      });
      
      if (card.type.includes('VICTORY')) {
        console.log(`[REPLACE EFFECT] card is a victory card`);
        const targets = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match,
        }).filter((id) => reactionContext?.[id]?.result !== 'immunity');
        
        for (const targetId of targets) {
          const curseCardId = match.basicSupply.find(cardId => cardLibrary.getCard(cardId).cardKey === 'curse');
          
          if (!curseCardId) {
            console.log(`[REPLACE EFFECT] no curse cards in supply`);
            break;
          }
          
          console.log(`[REPLACE EFFECT] ${getPlayerById(match, targetId)} gaining ${cardLibrary.getCard(curseCardId)}`);
          
          await runGameActionDelegate('gainCard', {
            playerId: targetId,
            cardId: curseCardId,
            to: { location: 'playerDiscards' },
          });
        }
      }
    }
  },
  'secret-passage': {
    registerEffects: () => async ({ match, cardLibrary, runGameActionDelegate, playerId }) => {
      console.log(`[SECRET PASSAGE EFFECT] drawing 2 cards...`);
      
      await runGameActionDelegate('drawCard', { playerId, count: 2 });
      
      console.log(`[SECRET PASSAGE EFFECT] gaining 1 action`);
      
      await runGameActionDelegate('gainAction', { count: 1 });
      
      if (match.playerHands[playerId].length === 0) {
        console.log(`[SECRET PASSAGE EFFECT] player has no cards in hand`);
        return;
      }
      
      console.log(`[SECRET PASSAGE EFFECT] prompting user to select card from hand`);
      const cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Choose card',
        playerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      }) as number[];
      
      const cardId = cardIds?.[0];
      
      if (!cardId) {
        console.warn(`[SECRET PASSAGE EFFECT] player selected card, but result doesn't have it`);
        return;
      }
      
      console.log(`[SECRET PASSAGE EFFECT] player chose ${cardLibrary.getCard(cardId)}`);
      
      if (match.playerDecks[playerId].length === 0) {
        console.log(`[SECRET PASSAGE EFFECT] player has no cards in deck, so just putting card on deck`);
        await runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerDecks' },
        });
        return;
      }
      
      console.log(`[SECRET PASSAGE EFFECT] prompting user to select location in deck`);
      
      const result = await runGameActionDelegate('userPrompt', {
        playerId: playerId,
        actionButtons: [
          { action: 1, label: 'DONE' },
        ],
        prompt: 'Position card',
        content: {
          type: 'blind-rearrange',
          cardIds: match.playerDecks[playerId],
        },
      }) as { action: number; result: number };
      
      const idx = result.result;
      
      console.log(`[SECRET PASSAGE EFFECT] moving card to deck at position ${idx}...`);
      
      await runGameActionDelegate('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: {
          location: 'playerDecks',
          index: idx,
        },
      });
    }
  },
  'shanty-town': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, cardLibrary, match }) => {
      console.log(`[SHANTY TOWN EFFECT] gaining 2 actions...`);
      
      await runGameActionDelegate('gainAction', { count: 2 });
      
      const hand = match.playerHands[playerId];
      
      for (const cardId of hand) {
        console.log(`[SHANTY TOWN EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('revealCard', {
          cardId,
          playerId,
        });
      }
      
      if (!hand.some((cardId) => cardLibrary.getCard(cardId).type.includes('ACTION'))) {
        console.log(`[SHANTY TOWN EFFECT] drawing 2 cards...`);
        
        await runGameActionDelegate('drawCard', { playerId, count: 2 });
      }
      else {
        console.log(`[SHANTY TOWN EFFECT] player has actions, not drawing cards`);
      }
    }
  },
  'steward': {
    registerEffects: () => async ({ match, cardLibrary, runGameActionDelegate, playerId }) => {
      console.log(`[STEWARD EFFECT] prompting user to choose cards, treasure, or trashing cards`);
      
      const result = await runGameActionDelegate('userPrompt', {
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
          console.log(`[STEWARD EFFECT] drawing 2 carda...`);
          await runGameActionDelegate('drawCard', { playerId, count: 2 });
          break;
        case 2:
          console.log(`[STEWARD EFFECT] gaining 2 treasure...`);
          await runGameActionDelegate('gainTreasure', {
            count: 2,
          });
          break;
        case 3: {
          if (match.playerHands[playerId].length === 0) {
            console.log(`[STEWARD EFFECT] no cards in hand to trash`);
            break;
          }
          
          const count = Math.min(2, match.playerHands[playerId].length);
          
          console.log(`[STEWARD EFFECT] prompting user to trash ${count} cards...`);
          
          const cardIds = await runGameActionDelegate('selectCard', {
            prompt: 'Confirm trash',
            playerId,
            restrict: { from: { location: 'playerHands' } },
            count,
          }) as number[];
          
          for (const cardId of cardIds) {
            console.log(`[STEWARD EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
            
            await runGameActionDelegate('trashCard', {
              playerId,
              cardId,
            });
          }
          break;
        }
      }
    }
  },
  'swindler': {
    registerEffects: () => async ({
      reactionContext,
      runGameActionDelegate,
      playerId,
      match,
      cardLibrary,
      cardPriceController
    }) => {
      console.log(`[SWINDLER EFFECT] gaining 2 treasure...`);
      
      await runGameActionDelegate('gainTreasure', {
        count: 2,
      });
      
      const targets = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter(id => reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[SWINDLER EFFECT] targets in order ${targets.map(id => getPlayerById(match, id)).join(',')}`);
      
      for (const target of targets) {
        const deck = match.playerDecks[target];
        
        if (deck.length === 0) {
          console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} as no cards, shuffling`);
          await runGameActionDelegate('shuffleDeck', {
            playerId: target
          });
          
          if (deck.length === 0) {
            console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} still has no cards`);
            continue;
          }
        }
        
        let cardId = deck.slice(-1)?.[0];
        const card = cardLibrary.getCard(cardId);
        
        console.log(`[SWINDLER EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('trashCard', {
          playerId: target,
          cardId: cardId,
        });
        
        const { cost } = cardPriceController.applyRules(card, { playerId });
        
        console.log(`[SWINDLER EFFECT] prompting user to select card costing ${cost.treasure}...`);
        
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Choose card',
          playerId,
          restrict: {
            from: { location: ['supply', 'kingdom'] },
            cost: { playerId, kind: 'exact', amount: cost },
          },
          count: 1,
        }) as number[];
        cardId = cardIds[0];
        
        console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} gaining ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('gainCard', {
          playerId: target,
          cardId,
          to: { location: 'playerDiscards' },
        });
      }
    }
  },
  'torturer': {
    registerEffects: () => async ({ reactionContext, runGameActionDelegate, playerId, match, cardLibrary }) => {
      console.log(`[TORTURER EFFECT] drawing 3 cards...`);
      
      await runGameActionDelegate('drawCard', { playerId, count: 3 });
      
      const targets = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[TORTURER EFFECT] targets ${targets.map(id => getPlayerById(match, id)).join(',')}`);
      
      // Each other player either discards 2 cards or gains a Curse to their hand,
      // their choice. (They may pick an option they can't do.)",
      for (const target of targets) {
        const player = getPlayerById(match, target);
        console.log(`[TORTURER EFFECT] prompting ${player} to choose to discard or gain curse to hand...`);
        
        const result = await runGameActionDelegate('userPrompt', {
          playerId: target,
          actionButtons: [
            { action: 1, label: 'DISCARD' },
            { action: 2, label: 'GAIN CURSE' },
          ],
          prompt: 'Choose one',
        }) as { action: number; };
        
        if (result.action === 1) {
          console.log(`[TORTURER EFFECT] prompting ${player} to discard 2 cards...`);
          
          const cardIds = match.playerHands[target].length < 2 ?
            match.playerHands[target] :
            await runGameActionDelegate('selectCard', {
              prompt: 'Confirm discard',
              playerId: target,
              restrict: { from: { location: 'playerHands' } },
              count: Math.min(2, match.playerHands[target].length)
            }) as number[];
          
          for (const cardId of cardIds) {
            console.log(`[TORTURER EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);
            
            await runGameActionDelegate('discardCard', {
              cardId,
              playerId: target,
            });
          }
          
          return
        }
        
        const curseCardId = match.basicSupply.find(cardId => cardLibrary.getCard(cardId).cardKey === 'curse');
        if (!curseCardId) {
          console.log(`[TORTURER EFFECT] no curse card in supply`);
          continue;
        }
        
        const card = cardLibrary.getCard(curseCardId);
        
        console.log(`[TORTURER EFFECT] gaining ${card}...`);
        
        await runGameActionDelegate('gainCard', {
          playerId: target,
          cardId: card.id,
          to: { location: 'playerHands' },
        });
      }
    }
  },
  'trading-post': {
    registerEffects: () => async ({ runGameActionDelegate, match, cardLibrary, playerId }) => {
      const count = Math.min(2, match.playerHands[playerId].length);
      
      if (count === 0) {
        console.log(`[TRADING POST EFFECT] no cards to trash`);
        return;
      }
      
      console.log(`[TRADING POST EFFECT] prompting user to trash ${count} cards...`);
      
      const cardIds = count < 2 ?
        match.playerHands[playerId] :
        await runGameActionDelegate('selectCard', {
          prompt: 'Confirm trash',
          playerId,
          restrict: { from: { location: 'playerHands' } },
          count,
        }) as number[];
      
      for (const cardId of cardIds) {
        console.log(`[TRADING POST EFFECT] trashing card ${cardLibrary.getCard(cardId)}`);
        
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId,
        });
      }
      
      if (cardIds.length === 2) {
        const silverCardId = match.basicSupply.find(cardId => cardLibrary.getCard(cardId).cardKey === 'silver');
        if (!silverCardId) {
          console.log(`[TRADING POST EFFECT] no silver in supply`);
          return;
        }
        
        const card = cardLibrary.getCard(silverCardId);
        
        console.log(`[TRADING POST EFFECT] gaining ${card}...`);
        
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId: silverCardId,
          to: { location: 'playerHands' },
        });
      }
      else {
        console.log(`[TRADING POST EFFECT] player trashed ${cardIds.length}, so no treasure gained`);
      }
    }
  },
  'upgrade': {
    registerEffects: () => async ({
      cardLibrary,
      runGameActionDelegate,
      match,
      playerId,
      cardPriceController
    }) => {
      console.log(`[UPGRADE EFFECT] drawing card...`);
      
      await runGameActionDelegate('drawCard', { playerId });
      
      console.log(`[UPGRADE EFFECT] gaining 1 action...`);
      
      await runGameActionDelegate('gainAction', { count: 1 });
      
      if (match.playerHands[playerId].length === 0) {
        console.log(`[UPGRADE EFFECT] no cards in hand`);
        return;
      }
      
      if (match.playerHands[playerId].length === 0) {
        console.log(`[UPGRADE EFFECT] no cards in hand, can't trash`);
        return;
      }
      
      console.log(`[UPGRADE EFFECT] prompting user to trash card from hand...`);
      
      let cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Confirm trash',
        playerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      }) as number[];
      
      const card = cardLibrary.getCard(cardIds[0]);
      
      console.log(`[UPGRADE EFFECT] trashing ${card}...`);
      
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId: card.id,
      });
      
      const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });
      
      console.log(`[UPGRADE EFFECT] prompting user to select card costing ${cardCost.treasure + 2}...`);
      
      cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Gain card',
        playerId,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { playerId, kind: 'exact', amount: { treasure: cardCost.treasure + 1, potion: cardCost.potion } },
        },
        count: 1,
      }) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[UPGRADE EFFECT] gaining ${cardLibrary.getCard(cardId)} to hand...`);
      
      await runGameActionDelegate('gainCard', {
        playerId,
        cardId,
        to: { location: 'playerDiscards' },
      });
    }
  },
  'wishing-well': {
    registerEffects: () => async ({ match, cardLibrary, runGameActionDelegate, playerId }) => {
      console.log(`[WISHING WELL EFFECT] drawing card...`);
      
      await runGameActionDelegate('drawCard', { playerId });
      
      console.log(`[WISHING WELL EFFECT] gaining 1 action...`)
      
      await runGameActionDelegate('gainAction', { count: 1 });
      
      // Name a card, then reveal the top card of your deck. If you named it, put it into your hand."
      console.log(`[WISHING WELL EFFECT] prompting user to name a card...`);
      
      const result = await runGameActionDelegate('userPrompt', {
        playerId,
        content: { type: 'name-card' },
        prompt: 'Name a card',
      }) as { action: number, result: CardKey };
      
      const cardKey: CardKey = result.result;
      
      console.log(`[WISHING WELL EFFECT] player named '${cardKey}'`);
      
      if (match.playerDecks[playerId].length === 0) {
        console.log(`[WISHING WELL EFFECT] shuffling player's deck...`);
        
        await runGameActionDelegate('shuffleDeck', {
          playerId
        });
      }
      
      const cardId = match.playerDecks[playerId].slice(-1)[0];
      
      console.log(`[WISHING WELL EFFECT] revealing card ${cardLibrary.getCard(cardId)}...`);
      
      await runGameActionDelegate('revealCard', {
        cardId,
        playerId,
      });
      
      const card = cardLibrary.getCard(cardId);
      if (card.cardKey === cardKey) {
        console.log(`[WISHING WELL EFFECT] moving ${card} to hand`);
        
        await runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerHands' }
        })
      }
    }
  }
}

export default expansionModule;
