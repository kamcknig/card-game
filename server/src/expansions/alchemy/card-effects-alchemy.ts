import { CardExpansionModuleNew } from '../../types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { Card, CardId } from 'shared/shared-types.ts';
import { getEffectiveCardCost } from '../../utils/get-effective-card-cost.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';

const expansion: CardExpansionModuleNew = {
  'alchemist': {
    registerEffects: () => async (args) => {
      console.log(`[alchemist effect] gaining 2 cards and 1 action`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      
      await args.runGameActionDelegate('gainAction', { count: 1 });
      
      args.reactionManager.registerReactionTemplate({
        id: `alchemist:${args.cardId}:startCleanUpPhase`,
        playerId: args.playerId,
        listeningFor: 'startTurnPhase',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          if (getTurnPhase(conditionArgs.match.turnPhaseIndex) !== 'cleanup') {
            return false;
          }
          
          if (conditionArgs.match.stats.playedCards[args.cardId]?.turnNumber !== conditionArgs.match.turnNumber) {
            return false;
          }
          
          const cardsInPlay = getCardsInPlay(conditionArgs.match).map(conditionArgs.cardLibrary.getCard);
          const ownedCardsInPlay = cardsInPlay.filter(card => card.owner === args.playerId);
          const potionCardsInPlay = ownedCardsInPlay.filter(card => card.cardKey === 'potion');
          
          return potionCardsInPlay.length > 0;
        },
        triggeredEffectFn: async (triggerEffectArgs) => {
          const result = await triggerEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: 'Top-deck Alchemist?',
            playerId: args.playerId,
            actionButtons: [
              { label: `Cancel`, action: 1 },
              { label: `Top-deck`, action: 2 }
            ],
          }) as { action: number, cardIds: number[] };
          
          if (result.action === 2) {
            console.log(`[alchemist triggered effect] player chose to top-deck alchemist`);
            await triggerEffectArgs.runGameActionDelegate('moveCard', {
              cardId: args.cardId,
              toPlayerId: args.playerId,
              to: { location: 'playerDecks' }
            });
          }
          else {
            console.log(`[alchemist triggered effect] player chose not to top-deck alchemist`);
          }
        }
      })
    }
  },
  'apothecary': {
    registerEffects: () => async (args) => {
      console.log(`[apothecary effect] gaining 1 card and 1 action`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      await args.runGameActionDelegate('gainAction', { count: 1 });
      
      const playerDeck = args.match.playerDecks[args.playerId];
      const playerDiscard = args.match.playerDiscards[args.playerId];
      
      const numToReveal = Math.min(4, playerDeck.length + playerDiscard.length);
      
      if (playerDeck.length < numToReveal) {
        await args.runGameActionDelegate('shuffleDeck', { playerId: args.playerId });
      }
      
      const cardsToReveal = playerDeck.slice(-numToReveal).map(args.cardLibrary.getCard);
      const setAside: Card[] = [];
      
      for (const card of cardsToReveal) {
        await args.runGameActionDelegate('revealCard', {
          cardId: card.id,
          playerId: args.playerId,
        });
        
        if (['copper', 'potion'].includes(card.cardKey)) {
          await args.runGameActionDelegate('moveCard', {
            cardId: card.id,
            toPlayerId: args.playerId,
            to: { location: 'playerHands' }
          });
        }
        else {
          setAside.push(card);
          await args.runGameActionDelegate('moveCard', {
            cardId: card.id,
            toPlayerId: args.playerId,
            to: { location: 'set-aside' }
          });
        }
      }
      
      const result = setAside.length === 1 ?
        { cardIds: setAside.map(card => card.id) } :
        await args.runGameActionDelegate('userPrompt', {
          prompt: 'Put on top of deck in any order',
          playerId: args.playerId,
          actionButtons: [{ label: 'DONE', action: 1 }],
          content: {
            type: 'rearrange',
            cardIds: setAside.map(card => card.id)
          },
        }) as { action: number, cardIds: number[] };
      
      if (result.cardIds.length > 0) {
        console.log(`[apothecary effect] putting cards back on top of deck ${result.cardIds.map(args.cardLibrary.getCard)}`);
        for (const cardId of result.cardIds) {
          await args.runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: args.playerId,
            to: { location: 'playerDecks' }
          });
        }
      }
    }
  },
  'apprentice': {
    registerEffects: () => async (args) => {
      console.log(`[apprentice effect] drawing 1 card`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      
      if (args.match.playerHands[args.playerId].length === 0) {
        return;
      }
      
      const selectedCardIds = await args.runGameActionDelegate('selectCard', {
        playerId: args.playerId,
        prompt: `Trash card`,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[apprentice effect] no card selected`);
        return;
      }
      
      const card = args.cardLibrary.getCard(selectedCardIds[0]);
      const numCardsToDraw = getEffectiveCardCost(
        args.playerId,
        card.id,
        args.match,
        args.cardLibrary
      ) + (card.cost.potion !== undefined ? 2 : 0);
      
      for (let i = 0; i < numCardsToDraw; i++) {
        if (!(await args.runGameActionDelegate('drawCard', { playerId: args.playerId }))) {
          break;
        }
      }
    }
  },
  'familiar': {
    registerEffects: () => async (args) => {
      console.log(`[familiar effect] gaining 1 card and 1 action`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      await args.runGameActionDelegate('gainAction', { count: 1 });
      
      const targets = findOrderedTargets({
        match: args.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: args.playerId
      }).filter((id) => args.reactionContext?.[id]?.result !== 'immunity');
      
      for (const targetId of targets) {
        const curseCardId =
          args.match.basicSupply.find(cardId => args.cardLibrary.getCard(cardId).cardKey === 'curse');
        
        if (curseCardId === undefined) {
          console.log(`[familiar effect] no curse card in basic supply`);
          break;
        }
        
        console.log(`[familiar effect] gaining curse card to ${getPlayerById(args.match, targetId)}`);
        
        await args.runGameActionDelegate('gainCard', {
          cardId: curseCardId,
          playerId: targetId,
          to: { location: 'playerDiscards' }
        }, {
          loggingContext: {
            source: args.cardId
          }
        });
      }
    }
  },
  'golem': {
    registerEffects: () => async (args) => {
      const deck = args.match.playerDecks[args.playerId];
      const discard = args.match.playerDiscards[args.playerId];
      
      const actionCardsSetAside: Card[] = [];
      const cardsToDiscard: Card[] = [];
      
      while (deck.length + discard.length > 0 && actionCardsSetAside.length !== 2) {
        if (deck.length === 0) {
          await args.runGameActionDelegate('shuffleDeck', { playerId: args.playerId });
        }
        
        const cardId = deck.slice(-1)[0];
        const card = args.cardLibrary.getCard(cardId);
        
        console.log(`[golem effect] revealing card ${card}`);
        await args.runGameActionDelegate('revealCard', {
          cardId: card.id,
          playerId: args.playerId,
        });
        
        console.log(`[golem effect] card is non-golem action, setting aside`);
        await args.runGameActionDelegate('moveCard', {
          cardId: card.id,
          toPlayerId: args.playerId,
          to: { location: 'set-aside' }
        });
        
        if (card.type.includes('ACTION') && card.cardKey !== 'golem') {
          actionCardsSetAside.push(card);
        }
        else {
          console.log(`[golem effect] card is golem, or action, setting aside to discard`);
          cardsToDiscard.push(card);
        }
      }
      
      console.log(`[golem effect] discarding ${cardsToDiscard.length} cards`);
      for (const card of cardsToDiscard) {
        await args.runGameActionDelegate('discardCard', { cardId: card.id, playerId: args.playerId });
      }
      
      const actions = actionCardsSetAside.map((card, idx) => ({
        label: `Play ${card.cardName}`,
        action: idx + 1,
      }));
      console.log(`[golem effect] playing ${actionCardsSetAside.length} cards`);
      
      const getAction = async () => {
        if (actions.length === 1) {
          return actions.shift()?.action;
        }
        
        const result = await args.runGameActionDelegate('userPrompt', {
          prompt: 'Choose to play',
          playerId: args.playerId,
          actionButtons: actions
        }) as { action: number, cardIds: number[] };
        const idx = actions.findIndex(action => action.action === result.action);
        actions.splice(idx, 1);
        return result.action;
      }
      
      while (actions.length > 0) {
        const action = await getAction();
        const card = actionCardsSetAside[action! - 1];
        await args.runGameActionDelegate('playCard', {
          cardId: card.id,
          playerId: args.playerId,
          overrides: {
            actionCost: 0
          }
        });
      }
    }
  },
  'herbalist': {
    registerEffects: () => async (args) => {
      console.log(`[herbalist effect] gaining 1 buy and 1 treasure`);
      await args.runGameActionDelegate('gainBuy', { count: 1 });
      await args.runGameActionDelegate('gainTreasure', { count: 1 });
      
      args.reactionManager.registerReactionTemplate({
        id: `herbalist:${args.cardId}:discardCard`,
        listeningFor: 'discardCard',
        once: true,
        allowMultipleInstances: true,
        compulsory: false,
        playerId: args.playerId,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== args.playerId) return false;
          if (!isLocationInPlay(conditionArgs.trigger.args.previousLocation)) return false;
          return conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId).type.includes('TREASURE');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const card = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          console.log(`[herbalist triggered effect] moving ${card} to top of deck`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: triggeredArgs.trigger.args.cardId,
            toPlayerId: args.playerId,
            to: { location: 'playerDecks' }
          });
        }
      })
    }
  },
  'philosophers-stone': {
    registerEffects: () => async (args) => {
      const cardCount = args.match.playerDecks[args.playerId].length + args.match.playerDiscards[args.playerId].length;
      const amountToGain = Math.floor(cardCount / 5);
      console.log(`[philosophers-stone effect] card count ${cardCount}, gaining ${amountToGain} treasure`);
      await args.runGameActionDelegate('gainTreasure', { count: amountToGain });
    }
  },
  'scrying-pool': {
    registerEffects: () => async (args) => {
      console.log(`[scrying-pool effect] gaining 1 action`);
      await args.runGameActionDelegate('gainAction', { count: 1 });
      const playedCard = args.cardLibrary.getCard(args.cardId);
      
      const targetIds = findOrderedTargets({
        match: args.match,
        appliesTo: playedCard.targetScheme!,
        startingPlayerId: args.playerId
      }).filter(t => args.reactionContext[t]?.result !== 'immunity');
      
      for (const targetPlayerId of targetIds) {
        const deck = args.match.playerDecks[targetPlayerId];
        
        if (deck.length === 0) {
          console.log(`[scrying-pool effect] no cards in deck, shuffling`);
          await args.runGameActionDelegate('shuffleDeck', { playerId: targetPlayerId });
          
          if (deck.length === 0) {
            console.log(`[scrying-pool effect] still no cards in deck, skipping`);
            continue;
          }
        }
        
        const cardId = deck.slice(-1)[0];
        const card = args.cardLibrary.getCard(cardId);
        
        console.log(`[scrying-pool effect] revealing card ${card}`);
        
        await args.runGameActionDelegate('revealCard', {
          cardId: cardId,
          playerId: targetPlayerId,
        });
        
        await args.runGameActionDelegate('moveCard', {
          cardId: cardId,
          toPlayerId: targetPlayerId,
          to: { location: 'set-aside' }
        });
        
        const result = await args.runGameActionDelegate('userPrompt', {
          prompt: `Discard or top-deck ${card.cardName}?`,
          playerId: args.playerId,
          actionButtons: [
            { label: `Discard`, action: 1 },
            { label: `Top-deck`, action: 2 }
          ],
        }) as { action: number, cardIds: number[] };
        
        if (result.action === 1) {
          console.log(`[scrying-pool effect] ${getPlayerById(args.match, args.playerId)} chose discard`);
          await args.runGameActionDelegate('discardCard', {
            cardId: cardId,
            playerId: targetPlayerId
          });
        }
        else {
          console.log(`[scrying-pool effect] ${getPlayerById(args.match, args.playerId)} chose top-deck`);
          await args.runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: targetPlayerId,
            to: { location: 'playerDecks' }
          });
        }
      }
    }
  },
  'potion': {
    registerEffects: () => async (args) => {
      await args.runGameActionDelegate('gainPotion', { count: 1 });
    }
  }
}

export default expansion;