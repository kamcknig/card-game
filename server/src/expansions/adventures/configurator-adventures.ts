import { ExpansionConfigurator } from '../../types.ts';
import { configureReserve } from './configure-reserve.ts';

const configurator: ExpansionConfigurator = async args => {
  
  configureReserve(args);
  
  return args.config;
}

export default configurator;
