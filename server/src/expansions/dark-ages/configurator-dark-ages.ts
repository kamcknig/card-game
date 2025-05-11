import { ExpansionConfiguratorFactory } from '../../types.ts';
import { configureSpoils } from './configure-spoils.ts';
import { configureRuins } from './configure-ruins.ts';

const configurator: ExpansionConfiguratorFactory = () => async (args) => {
  await configureSpoils(args);
  await configureRuins(args);
  return args.config;
}

export default configurator;