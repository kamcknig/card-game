import { ExpansionConfiguratorFactory } from '@server-types/index.ts';
import { registerBaseV2TokenDefinitions } from './token-definitions-base-v2.ts';

const configurator: ExpansionConfiguratorFactory = () => async (args) => {
  registerBaseV2TokenDefinitions(args.expansionRegistration.registerTokenDefinition);
  return args.config;
};

export default configurator;
