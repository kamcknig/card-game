import { ExpansionConfiguratorFactory } from '../../types.ts';
import { addMatToMatchConfig } from '../../utils/add-mat-to-match-config.ts';

const configurator: ExpansionConfiguratorFactory = () => (args) => {
  for (const kingdomCard of args.config.kingdomCards) {
    if (kingdomCard.mat) {
      console.log(`[seaside configurator] adding ${kingdomCard.mat} for ${args.cardLibrary[kingdomCard.cardKey]} to config`);
      addMatToMatchConfig(kingdomCard.mat, args.config)
    }
  }
  
  return args.config;
}

export default configurator;