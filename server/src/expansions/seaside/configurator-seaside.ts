import { ExpansionConfiguratorFactory } from '../../types.ts';
import { addMatToMatchConfig } from '../../utils/add-mat-to-match-config.ts';

const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
    for (const kingdomCard of args.config.kingdomSupply) {
      if (kingdomCard.card.mat) {
        console.log(`[seaside configurator] adding ${kingdomCard.card.mat} for ${args.cardLibrary[kingdomCard.card.cardKey]} to config`);
        addMatToMatchConfig(kingdomCard.card.mat, args.config, args);
      }
    }
    
    return args.config;
  }
}

export default configurator;