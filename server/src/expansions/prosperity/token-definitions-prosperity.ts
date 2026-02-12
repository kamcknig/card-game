import { registerTokenDefinition } from '../../core/tokens/token-definition-map.ts';
import { prosperityTokenIds } from './token-prosperity-ids.ts';

export const registerProsperityTokenDefinitions = () => {
  registerTokenDefinition({
    id: prosperityTokenIds.victory,
    name: 'Victory Token',
    duration: 'permanent',
    expansion: 'prosperity',
    rulesText: 'Counts as 1 victory point when scoring at the end of the game.',
  });
};
