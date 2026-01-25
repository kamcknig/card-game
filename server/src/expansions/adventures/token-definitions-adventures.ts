import { registerTokenDefinition } from '../../core/tokens/token-definition-map.ts';
import { adventuresTokenIds } from './token-ids-adventures.ts';

// Registers Adventures vanilla bonus token definitions.
export const registerAdventuresTokenDefinitions = (): void => {
  registerTokenDefinition({
    id: adventuresTokenIds.plusAction,
    name: '+1 Action token',
    rulesText: 'When you play a card from this pile, +1 Action.',
    duration: 'permanent',
    expansion: 'adventures',
  });
  
  registerTokenDefinition({
    id: adventuresTokenIds.plusBuy,
    name: '+1 Buy token',
    rulesText: 'When you play a card from this pile, +1 Buy.',
    duration: 'permanent',
    expansion: 'adventures',
  });
  
  registerTokenDefinition({
    id: adventuresTokenIds.plusCard,
    name: '+1 Card token',
    rulesText: 'When you play a card from this pile, +1 Card.',
    duration: 'permanent',
    expansion: 'adventures',
  });
  
  registerTokenDefinition({
    id: adventuresTokenIds.plusCoin,
    name: '+$1 token',
    rulesText: 'When you play a card from this pile, +$1.',
    duration: 'permanent',
    expansion: 'adventures',
  });
  
  registerTokenDefinition({
    id: adventuresTokenIds.minusCoin,
    name: '-$1 token',
    rulesText: 'The next time you get $, get $1 less.',
    duration: 'oneShot',
    expansion: 'adventures',
  });
  
  registerTokenDefinition({
    id: adventuresTokenIds.minusCard,
    name: '-1 Card token',
    rulesText: 'The next time you draw cards, draw one fewer.',
    duration: 'oneShot',
    expansion: 'adventures',
  });
};
