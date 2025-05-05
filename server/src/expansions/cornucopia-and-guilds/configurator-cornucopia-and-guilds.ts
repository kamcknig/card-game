import './types.ts'
import { ActionRegistry, ClientEventRegistry, ExpansionConfiguratorFactory, GameEventRegistrar } from '../../types.ts';
import { configureYoungWitch } from './check-young-witch.ts';
import { configureFerryman } from './configure-ferryman.ts';
import { ComputedMatchConfiguration } from 'shared/shared-types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { findCards } from '../../utils/find-cards.ts';

export const configurator: ExpansionConfiguratorFactory = () => {
  return (args) => {
    configureYoungWitch(args);
    configureFerryman(args);
    return args.config;
  }
}

export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (registrar, config) => {
  if (config.kingdomCards.some(card => card.cardKey === 'footpad')) {
    console.log(`[cornucopia configurator] setting up footpad onCardGained handler`);
    
    registrar('onCardGained', async (args, eventArgs) => {
      if (getTurnPhase(args.match.turnPhaseIndex) !== 'action') return;
      
      const card = args.cardLibrary.getCard(eventArgs.cardId);
      
      console.log(`[cornucopia onCardGained event] player ${eventArgs.playerId} gained ${card} during action phase, drawing card`);
      
      // todo hacky to use just any card by id for the source. eventually source needs to be more dynamic
      const footpadCardIds = findCards(
        args.match,
        { cards: { cardKeys: 'footpad' } },
        args.cardLibrary
      );
      
      await args.runGameActionDelegate('drawCard', { playerId: eventArgs.playerId }, { loggingContext: { source: footpadCardIds[0] } });
    });
  }
  
  if (config.kingdomCards.some(card => card.cardKey === 'baker')) {
    console.log(`[cornucopia configurator] setting up baker onGameStart handler`);
    
    registrar('onGameStart', async (args) => {
      console.log(`[cornucopia onGameStart event] setting up baker - +1 coffer to each player on game start`);
      args.match.coffers ??= {};
      for (const player of args.match.players) {
        args.match.coffers[player.id] ??= 0;
        args.match.coffers[player.id] += 1;
      }
    });
  }
}

export const registerClientEvents: ClientEventRegistry = (registrar, { match }) => {
  match.coffers ??= {};
  
  registrar('spendCoffer', (playerId, count) => {
    match.coffers![playerId] -= count;
    match.playerTreasure += count;
  });
}

export const registerActions: ActionRegistry = (registerFn, { match }) => {
  match.coffers ??= {};
  
  registerFn('gainCoffer', async (args) => {
    console.log(`[gainCoffers action] player ${args.playerId} gained ${args.count} coffers`);
    match.coffers![args.playerId] ??= 0;
    match.coffers![args.playerId] += args.count ?? 1;
    console.log(`[gainCoffers action] player ${args.playerId} now has ${match.coffers![args.playerId]} coffers`);
  });
}

export default configurator;