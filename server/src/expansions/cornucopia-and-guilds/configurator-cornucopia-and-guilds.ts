import { ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { configureYoungWitch } from './configure-young-witch.ts';
import { configureFerryman } from './configure-ferryman.ts';
import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { configureJoust } from './configure-joust.ts';

export const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
    configureYoungWitch(args);
    configureFerryman(args);
    await configureJoust(args);
    return args.config;
  };
};

export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  if (config.kingdomSupply.some((supply) => supply.name === 'footpad')) {
    console.info(`[cornucopia configurator] setting up footpad onCardGained handler`);

    registrar('onCardGained', async (args, eventArgs) => {
      if (getTurnPhase(args.match.turnPhaseIndex) !== 'action') return;

      const card = args.cardLibrary.getCard(eventArgs.cardId);

      console.info(
        `[footpad onCardGained event] player ${eventArgs.playerId} gained ${card} during action phase, drawing card`,
      );

      // todo hacky to use just any card by id for the source. eventually source needs to be more dynamic
      const footpadCardIds = args.findCardService.findCards({ cardKeys: 'footpad' });

      await args.runGameActionDelegate('drawCard', { playerId: eventArgs.playerId }, {
        loggingContext: { source: footpadCardIds[0].id },
      });
    });
  }

  if (config.kingdomSupply.some((supply) => supply.name === 'baker')) {
    console.info(`[cornucopia configurator] setting up baker onGameStart handler`);

    registrar('onGameStart', async (args) => {
      console.info(`[baker onGameStart event] setting up baker - +1 coffer to each player on game start`);
      for (const player of args.match.players) {
        await args.runGameActionDelegate('gainCoffer', { playerId: player.id, count: 1 });
      }
    });
  }
};

export default configurator;
