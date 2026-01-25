import { ExpansionConfiguratorFactory, GameEventRegistrar } from '../../types.ts';
import { configureReserve } from './configure-reserve.ts';
import { registerAdventuresTokenDefinitions } from './token-definitions-adventures.ts';
import { registerAdventuresTokenTriggers } from './token-triggers-adventures.ts';
import { ComputedMatchConfiguration, TokenId } from 'shared/shared-types.ts';
import { adventuresTokenIds } from './token-ids-adventures.ts';

const configurator: ExpansionConfiguratorFactory = () => async args => {
  
  configureReserve(args);
  registerAdventuresTokenDefinitions();
  registerAdventuresTokenTriggers();
  
  return args.config;
}

export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (registrar, config) => {
  // Register the -$1 token reaction handler for all Adventures games.
  registrar('onGameStart', async (args) => {
    for (const player of args.match.players) {
      args.reactionManager.registerReactionTemplate({
        id: `adventures-minus-coin-token:0:treasureGain:${player.id}`,
        listeningFor: 'treasureGain',
        playerId: player.id,
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        system: true,
        condition: async ({ trigger, match }) => {
          if (trigger.args.playerId !== player.id) return false;
          if (trigger.args.count <= 0) return false;
          // Only react when the player's -$1 token is currently in front of them.
          return Object.values(match.tokens ?? {}).some(token =>
            token.tokenId === adventuresTokenIds.minusCoin &&
            token.ownerId === player.id &&
            token.location.type === 'player' &&
            token.location.playerId === player.id
          );
        },
        triggeredEffectFn: async ({ match, runGameActionDelegate, trigger }) => {
          const tokenEntry = Object.entries(match.tokens ?? {}).find(([_tokenInstanceId, token]) =>
            token.tokenId === adventuresTokenIds.minusCoin &&
            token.ownerId === player.id &&
            token.location.type === 'player' &&
            token.location.playerId === player.id
          );
          if (!tokenEntry) return;
          // Consume the -$1 token once when a positive treasure gain occurs.
          trigger.args.count = Math.max(0, trigger.args.count - 1);
          await runGameActionDelegate('removeToken', { tokenInstanceId: tokenEntry[0] });
        }
      });
    }
  });
  // Only grant the vanilla bonus tokens when Teacher is in the kingdom.
  if (!config.kingdomSupply.some(supply => supply.name === 'teacher')) {
    return;
  }
  
  console.log(`[adventures configurator] setting up teacher onGameStart handler for vanilla tokens`);
  
  registrar('onGameStart', async (args) => {
    // Teacher grants one of each vanilla bonus token to every player.
    const tokenIds: TokenId[] = [
      adventuresTokenIds.plusAction,
      adventuresTokenIds.plusBuy,
      adventuresTokenIds.plusCard,
      adventuresTokenIds.plusCoin,
    ];
    
    for (const player of args.match.players) {
      for (const tokenId of tokenIds) {
        // Avoid duplicating tokens when a saved state already contains them.
        const alreadyOwned = Object.values(args.match.tokens ?? {}).some(token => token.ownerId === player.id && token.tokenId === tokenId);
        if (alreadyOwned) continue;
        // Place unassigned tokens in the player's area until they are moved to a supply pile.
        await args.runGameActionDelegate('placeToken', {
          tokenId,
          ownerId: player.id,
          location: { type: 'player', playerId: player.id },
        });
      }
    }
  });
};

export default configurator;
