import { registerTokenCardPlayedHandler } from '../../core/tokens/token-trigger-map.ts';
import { adventuresTokenIds } from './token-ids-adventures.ts';

// Registers card-played triggers for Adventures vanilla bonus tokens.
export const registerAdventuresTokenTriggers = (): void => {
  registerTokenCardPlayedHandler(adventuresTokenIds.plusAction, async ({ runGameAction }) => {
    await runGameAction('gainAction', { count: 1 });
  });

  registerTokenCardPlayedHandler(adventuresTokenIds.plusBuy, async ({ runGameAction }) => {
    await runGameAction('gainBuy', { count: 1 });
  });

  registerTokenCardPlayedHandler(adventuresTokenIds.plusCard, async ({ runGameAction, playerId }) => {
    await runGameAction('drawCard', { playerId, count: 1 });
  });

  registerTokenCardPlayedHandler(adventuresTokenIds.plusCoin, async ({ runGameAction }) => {
    await runGameAction('gainTreasure', { count: 1 });
  });
};
