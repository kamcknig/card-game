import { CardNoId, Supply } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { createCardData } from '../../utils/create-card-data.ts';

export const configureUrchin = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(supply => supply.name === 'urchin')) {
    return;
  }
  
  if (args.config.nonSupply?.some(supply => supply.name === 'mercenary')) {
    return;
  }
  
  console.log(`[dark-ages configurator - configuring urchin] urchin needs to be configured`);
  
  let mercenaryCardLibrary: Record<string, CardNoId> = {};
  
  try {
    const mercenaryCardLibraryModule = await import('./card-library-mercenary.json', { with: { type: 'json' } });
    mercenaryCardLibrary = mercenaryCardLibraryModule.default as unknown as Record<string, CardNoId>;
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[dark-ages configurator - configuring urchin] failed to load mercenary library`);
      return;
    }
  }
  
  const cardData = createCardData('mercenary', 'dark-ages', {
    ...mercenaryCardLibrary['mercenary'] ?? {},
    partOfSupply: false,
  });
  
  args.config.nonSupply ??= [];
  
  args.config.nonSupply.push({
    name: 'mercenary',
    cards: new Array(10).fill({...cardData})
  } as Supply);
  
  console.log(`[dark-ages configurator - configuring urchin] urchin configured`);
};