import { registerTokenCardPlayedHandler } from '../../core/tokens/token-trigger-map.ts';
import { adventuresTokenIds } from './token-ids-adventures.ts';

// Registers card-played triggers for Adventures vanilla bonus tokens.
export const registerAdventuresTokenTriggers = (): void => {
  registerTokenCardPlayedHandler(adventuresTokenIds.plusAction, async ({ actionService }) => {
    await actionService.run('gainAction', { count: 1 });
  });

  registerTokenCardPlayedHandler(adventuresTokenIds.plusBuy, async ({ actionService }) => {
    await actionService.run('gainBuy', { count: 1 });
  });

  registerTokenCardPlayedHandler(adventuresTokenIds.plusCard, async ({ actionService, playerId }) => {
    await actionService.run('drawCard', { playerId, count: 1 });
  });

  registerTokenCardPlayedHandler(adventuresTokenIds.plusCoin, async ({ actionService }) => {
    await actionService.run('gainTreasure', { count: 1 });
  });
};
