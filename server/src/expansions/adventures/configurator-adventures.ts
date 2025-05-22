import { ExpansionConfiguratorFactory } from '../../types.ts';
import { configureReserve } from './configure-reserve.ts';

const configurator: ExpansionConfiguratorFactory = () => async args => {
  
  configureReserve(args);
  
  return args.config;
}

export default configurator;
