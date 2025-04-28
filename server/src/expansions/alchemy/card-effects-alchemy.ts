import { CardExpansionModuleNew } from '../../types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';

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
            await triggerEffectArgs.runGameActionDelegate('moveCard', {
              cardId: args.cardId,
              toPlayerId: args.playerId,
              to: { location: 'playerDecks' }
            });
          }
        }
      })
    }
  },
  'potion': {
    registerEffects: () => async (args) => {
      await args.runGameActionDelegate('gainPotion', { count: 1 });
    }
  }
}

export default expansion;