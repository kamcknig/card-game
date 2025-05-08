import { ExpansionConfiguratorFactory, GameEventRegistrar } from '../../types.ts';
import { configureYoungWitch } from './configure-young-witch.ts';
import { configureFerryman } from './configure-ferryman.ts';
import { ComputedMatchConfiguration } from 'shared/shared-types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { configureJoust } from './configure-joust.ts';

export const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
    configureYoungWitch(args);
    configureFerryman(args);
    await configureJoust(args);
    return args.config;
  }
}

export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (registrar, config) => {
  if (config.kingdomCards.some(card => card.cardKey === 'footpad')) {
    console.log(`[cornucopia configurator] setting up footpad onCardGained handler`);
    
    registrar('onCardGained', async (args, eventArgs) => {
      if (getTurnPhase(args.match.turnPhaseIndex) !== 'action') return;
      
      const card = args.cardLibrary.getCard(eventArgs.cardId);
      
      console.log(`[footpad onCardGained event] player ${eventArgs.playerId} gained ${card} during action phase, drawing card`);
      
      // todo hacky to use just any card by id for the source. eventually source needs to be more dynamic
      const footpadCardIds = args.findCards(
        { cards: { cardKeys: 'footpad' } }
      );
      
      await args.runGameActionDelegate('drawCard', { playerId: eventArgs.playerId }, { loggingContext: { source: footpadCardIds[0].id } });
    });
  }
  
  if (config.kingdomCards.some(card => card.cardKey === 'baker')) {
    console.log(`[cornucopia configurator] setting up baker onGameStart handler`);
    
    registrar('onGameStart', async (args) => {
      console.log(`[baker onGameStart event] setting up baker - +1 coffer to each player on game start`);
      for (const player of args.match.players) {
        await args.runGameActionDelegate('gainCoffer', { playerId: player.id, count: 1});
      }
    });
  }
}

export default configurator;