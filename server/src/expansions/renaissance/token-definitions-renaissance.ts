import { registerTokenDefinition } from '../../core/tokens/token-definition-map.ts';

// Registers Renaissance token definitions (e.g., Project cubes).
export const registerRenaissanceTokenDefinitions = (): void => {
  registerTokenDefinition({
    id: 'cube-token',
    name: 'Cube',
    rulesText: 'Used to claim Projects.',
    duration: 'permanent',
    expansion: 'renaissance',
  });

  registerTokenDefinition({
    id: 'renaissance:sinister-plot',
    name: 'Sinister Plot token',
    rulesText: 'At the start of your turn, either add one here or remove yours to draw that many cards.',
    duration: 'permanent',
    expansion: 'renaissance',
  });
};
