import { ExpansionConfiguratorContext } from '../../types.ts';
import { expansionLibrary } from '../expansion-library.ts';

export const configureSpoils = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(kingdom => ['marauder', 'pillage', 'bandit-camp'].includes(kingdom.name))) {
    return;
  }
  
  if (args.config.nonSupply?.some(supply => !supply.cards.some(card => card.tags?.includes('spoils')))) {
    console.log(`[dark-ages configurator - configuring spoils] spoils cards in kingdom already, not configuring`);
    return;
  }
  
  console.log(`[dark-ages configurator - configuring spoils] spoils needs to be configured`);
  
  args.config.nonSupply ??= [];
  
  const card = {
    ...structuredClone(expansionLibrary['dark-ages'].cardData.kingdomSupply['spoils']),
    partOfSupply: false,
    tags: ['spoils'],
  }
  
  args.config.nonSupply.push({
    name: 'spoils',
    cards: new Array(15).fill({ ...card }),
  });
  
  console.log(`[dark-ages configurator - configuring spoils] spoils configured`);
};