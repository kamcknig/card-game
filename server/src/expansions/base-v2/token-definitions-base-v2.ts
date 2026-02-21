import { TokenDefinitionRegistrar } from '@server-types/index.ts';
import { baseV2TokenIds } from './token-ids-base-v2.ts';

// Registers Base token definitions used across expansions.
export const registerBaseV2TokenDefinitions = (registerTokenDefinition: TokenDefinitionRegistrar): void => {
  registerTokenDefinition({
    id: baseV2TokenIds.coin,
    name: 'Coin token',
    rulesText: 'A generic counter token used by card effects.',
    duration: 'permanent',
    expansion: 'base-v2',
  });
};
