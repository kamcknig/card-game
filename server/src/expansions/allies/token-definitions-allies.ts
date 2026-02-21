import { TokenDefinitionRegistrar } from '@server-types/index.ts';
import { alliesTokenIds } from './token-ids-allies.ts';

// Registers Allies token definitions used by Ally effects.
export const registerAlliesTokenDefinitions = (registerTokenDefinition: TokenDefinitionRegistrar): void => {
  registerTokenDefinition({
    id: alliesTokenIds.favor,
    name: 'Favor token',
    rulesText: 'A token representing favors originally from Allies expansion.',
    duration: 'permanent',
    expansion: 'allies',
  });
};
