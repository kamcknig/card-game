import { Supply } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { expansionLibrary } from '../expansion-library.ts';

export const configureHermit = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(supply => supply.name === 'hermit')) {
    return;
  }
  
  if (args.config.nonSupply?.some(supply => supply.name === 'madman')) {
    return;
  }
  
  console.log(`[dark-ages configurator - configuring hermit] hermit needs to be configured`);
  
  const cardData = {
    ...structuredClone(expansionLibrary['dark-ages'].cardData.kingdomSupply['madman']) ?? {},
    partOfSupply: false
  };
  
  args.config.nonSupply ??= [];
  
  args.config.nonSupply.push({
    name: 'madman',
    cards: new Array(10).fill({...cardData})
  } as Supply);
  
  console.log(`[dark-ages configurator - configuring hermit] ruins configured`);
};