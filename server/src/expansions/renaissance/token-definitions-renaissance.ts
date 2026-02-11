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
};
