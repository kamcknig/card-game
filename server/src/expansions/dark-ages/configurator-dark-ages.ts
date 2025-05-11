import { ExpansionConfiguratorFactory } from '../../types.ts';
import { configureSpoils } from './configure-spoils.ts';

const configurator: ExpansionConfiguratorFactory = () => async (args) => {
  configureSpoils(args);
  return args.config;
}

export default configurator;