import { ExpansionConfiguratorFactory } from '../../types.ts';
import { configureReserve } from './configure-reserve.ts';
import { registerAdventuresTokenDefinitions } from './token-definitions-adventures.ts';
import { registerAdventuresTokenTriggers } from './token-triggers-adventures.ts';

const configurator: ExpansionConfiguratorFactory = () => async args => {
  
  configureReserve(args);
  registerAdventuresTokenDefinitions();
  registerAdventuresTokenTriggers();
  
  return args.config;
}

export default configurator;
