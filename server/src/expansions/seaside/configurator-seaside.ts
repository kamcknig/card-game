import { ExpansionConfiguratorFactory } from '../../types.ts';
import { addMatToMatchConfig } from '../../utils/add-mat-to-match-config.ts';

const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
    for (const supply of args.config.kingdomSupply) {
      const matsAdded: string[] = [];
      for (const card of supply.cards) {
        if (card.mat && !matsAdded.includes(card.mat)) {
          console.log(`[seaside configurator] adding ${card.mat} for ${args.cardLibrary[card.cardKey]} to config`);
          addMatToMatchConfig(card.mat, args.config, args);
          matsAdded.push(card.mat);
        }
      }
    }
    
    return args.config;
  }
}

export default configurator;