import { ExpansionConfiguratorFactory, GameEventRegistrar, GameLifecycleCallbackContext } from '@server-types/index.ts';
import { configureYoungWitch } from './configure-young-witch.ts';
import { configureFerryman } from './configure-ferryman.ts';
import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { configureJoust } from './configure-joust.ts';
import { configureTournament } from './configure-tournament.ts';

export const configurator: ExpansionConfiguratorFactory = () => {
  return async args => {
    configureYoungWitch(args);
    configureFerryman(args);
    await configureJoust(args);
    await configureTournament(args);
    return args.config;
  };
};

// Registers Footpad's "when you gain a card during your Action phase, +1 Card" game event.
// Extracted so it can also be registered when Footpad is dealt mid-game by Rising Sun's Divine Wind
// (FAQ: new piles run their Setup). The registrar is either match-controller's game-event registrar
// (game start) or a runtime shim over reactionManager.registerGameEvent (mid-game) — both push into
// the same handler list, so the behavior is identical at either call site.
export const registerFootpadGainReaction = (registrar: GameEventRegistrar): void => {
  registrar('onCardGained', async (args, eventArgs) => {
    if (getTurnPhase(args.match.turnPhaseIndex) !== 'action') return;

    const card = args.cardLibrary.getCard(eventArgs.cardId);

    args.loggerService.info(
      `[footpad onCardGained event] player ${eventArgs.playerId} gained ${card} during action phase, drawing card`,
    );

    // todo hacky to use just any card by id for the source. eventually source needs to be more dynamic
    const footpadCardIds = args.findCardService.findCards({ cardKeys: 'footpad' });

    await args.actionService.run(
      'drawCard',
      { playerId: eventArgs.playerId },
      {
        source: footpadCardIds[0].id,
      },
    );
  });
};

// Applies Baker's Setup: +1 Coffer to each player. Extracted so it can run both at game start
// (wrapped in an onGameStartSetup handler) and immediately when Baker is dealt mid-game by Divine
// Wind (a mid-game onGameStartSetup registration would never re-fire, so the dispatch runs it
// directly).
export const setupBakerCoffers = async (args: Omit<GameLifecycleCallbackContext, 'cardId'>): Promise<void> => {
  args.loggerService.info(`[baker onGameStart event] setting up baker - +1 coffer to each player on game start`);
  for (const player of args.match.players) {
    await args.actionService.run('gainCoffer', { playerId: player.id, count: 1 });
  }
};

export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  if (config.kingdomSupply.some(supply => supply.name === 'footpad')) {
    registerFootpadGainReaction(registrar);
  }

  if (config.kingdomSupply.some(supply => supply.name === 'baker')) {
    registrar('onGameStartSetup', async args => {
      await setupBakerCoffers(args);
    });
  }
};

export default configurator;
