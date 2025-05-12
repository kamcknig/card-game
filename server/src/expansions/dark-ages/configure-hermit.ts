import { CardNoId, Supply } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { createCardData } from '../../utils/create-card-data.ts';

export const configureHermit = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(supply => supply.name === 'hermit')) {
    return;
  }
  
  if (args.config.nonSupply?.some(supply => supply.name === 'madman')) {
    return;
  }
  
  console.log(`[dark-ages configurator - configuring hermit] hermit needs to be configured`);
  
  let madmanCardLibrary: Record<string, CardNoId> = {};
  
  try {
    const madmanCardLibraryModule = await import('./card-library-madman.json', { with: { type: 'json' } });
    madmanCardLibrary = madmanCardLibraryModule.default as unknown as Record<string, CardNoId>;
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[dark-ages configurator - configuring hermit] failed to load madman library`);
      return;
    }
  }
  
  const cardData = createCardData('madman', 'dark-ages', {
    ...madmanCardLibrary['madman'] ?? {}
  });
  
  args.config.nonSupply ??= [];
  
  args.config.nonSupply.push({
    name: 'madman',
    cards: new Array(10).fill({...cardData})
  } as Supply);
  
  console.log(`[dark-ages configurator - configuring hermit] ruins configured`);
};