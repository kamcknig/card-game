import { TokenDefinitionRegistrar } from '@server-types/index.ts';
import { risingSunTokenIds } from './token-ids-rising-sun.ts';

// Registers Rising Sun token definitions used by prophecy setup and omen effects.
export const registerRisingSunTokenDefinitions = (registerTokenDefinition: TokenDefinitionRegistrar): void => {
  registerTokenDefinition({
    id: risingSunTokenIds.sun,
    name: 'Sun token',
    rulesText: 'Removed by Omens; when the last token is removed, the Prophecy becomes active.',
    duration: 'permanent',
    expansion: 'rising-sun',
  });
};
