import { CardExpansionModuleNew } from '../../types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { Card } from 'shared/shared-types.ts';

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
          await args.runGameActionDelegate('setAside', {
            cardId: card.id,
            playerId: args.playerId,
            sourceCardId: args.cardId,
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
  'potion': {
    registerEffects: () => async (args) => {
      await args.runGameActionDelegate('gainPotion', { count: 1 });
    }
  }
}

export default expansion;