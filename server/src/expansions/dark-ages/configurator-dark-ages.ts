import { ExpansionConfiguratorFactory } from '@server-types/index.ts';
import { configureSpoils } from './configure-spoils.ts';
import { configureRuins } from './configure-ruins.ts';
import { configureKnights } from './configure-knights.ts';
import { configureHermit } from './configure-hermit.ts';
import { configureUrchin } from './configure-urchin.ts';
import { configureShelters } from './configure-shelters.ts';

const configurator: ExpansionConfiguratorFactory = () => async args => {
  await configureSpoils(args);
  await configureShelters(args);
  await configureRuins(args);
  await configureKnights(args);
  await configureHermit(args);
  await configureUrchin(args);
  return args.config;
};

export default configurator;
