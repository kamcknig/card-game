import { TokenDefinitionRegistrar } from '@server-types/index.ts';
import { renaissanceTokenIds } from './token-ids-renaissance.ts';

// Registers Renaissance token definitions (e.g., Project cubes).
export const registerRenaissanceTokenDefinitions = (registerTokenDefinition: TokenDefinitionRegistrar): void => {
  registerTokenDefinition({
    id: renaissanceTokenIds.cube,
    name: 'Cube',
    rulesText: 'Used to claim Projects.',
    duration: 'permanent',
    expansion: 'renaissance',
  });

  registerTokenDefinition({
    id: renaissanceTokenIds.sinisterPlot,
    name: 'Sinister Plot token',
    rulesText: 'At the start of your turn, either add one here or remove yours to draw that many cards.',
    duration: 'permanent',
    expansion: 'renaissance',
  });
};
