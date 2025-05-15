import { ExpansionConfiguratorFactory } from '../../types.ts';
import { configureSpoils } from './configure-spoils.ts';
import { configureRuins } from './configure-ruins.ts';
import { configureHermit } from './configure-hermit.ts';
import { configureUrchin } from './configure-urchin.ts';
import { configureShelters } from './configure-shelters.ts';

const configurator: ExpansionConfiguratorFactory = () => async (args) => {
  await configureSpoils(args);
  await configureRuins(args);
  await configureHermit(args);
  await configureUrchin(args)
  await configureShelters(args);
  return args.config;
}

export default configurator;