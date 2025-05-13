import { Supply } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { expansionLibrary } from '../expansion-library.ts';

export const configureUrchin = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(supply => supply.name === 'urchin')) {
    return;
  }
  
  if (args.config.nonSupply?.some(supply => supply.name === 'mercenary')) {
    return;
  }
  
  console.log(`[dark-ages configurator - configuring urchin] urchin needs to be configured`);
  
  const cardData = {
    ...structuredClone(expansionLibrary['dark-ages'].cardData.kingdomSupply['mercenary']) ?? {},
    partOfSupply: false,
  };
  
  args.config.nonSupply ??= [];
  
  args.config.nonSupply.push({
    name: 'mercenary',
    cards: new Array(10).fill({...cardData})
  } as Supply);
  
  console.log(`[dark-ages configurator - configuring urchin] urchin configured`);
};