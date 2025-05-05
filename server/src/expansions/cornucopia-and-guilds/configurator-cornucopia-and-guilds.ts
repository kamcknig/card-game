import './types.ts'
import { ActionRegistry, ClientEventRegistry, ExpansionConfiguratorFactory, GameEventRegistrar } from '../../types.ts';
import { configureYoungWitch } from './check-young-witch.ts';

export const configurator: ExpansionConfiguratorFactory = () => {
  return (args) => {
    configureYoungWitch(args);
    return args.config;
  }
}

export const registerGameEvents: (registrar: GameEventRegistrar) => void = (registrar) => {
  registrar('onGameStart', async (args) => {
    if (!args.match.config.kingdomCards.some(card => card.cardKey === 'baker')) {
      return;
    }
    console.log(`[cornucopia onGameStart event] adding initial 1 coffer to players because baker is present`);
    args.match.coffers ??= {};
    for (const player of args.match.players) {
      args.match.coffers[player.id] ??= 0;
      args.match.coffers[player.id] += 1;
    }
  });
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