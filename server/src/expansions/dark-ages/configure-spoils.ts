import { CardNoId } from 'shared/shared-types.ts';
import { ExpansionConfiguratorContext } from '../../types.ts';
import { createCardData } from '../../utils/create-card-data.ts';

export const configureSpoils = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomSupply.some(kingdom => ['marauder', 'pillage', 'bandit-camp'].includes(kingdom.name))) {
    return;
  }
  
  if (args.config.nonSupply?.some(supply => !supply.cards.some(card => card.tags?.includes('spoils')))) {
    console.log(`[dark-ages configurator - configuring spoils] spoils cards in kingdom already, not configuring`);
    return;
  }
  
  console.log(`[dark-ages configurator - configuring spoils] spoils needs to be configured`);
  
  let spoilsCardLibrary: Record<string, CardNoId> = {};
  
  try {
    const spoilsCardLibraryModule = await import('./card-library-spoils.json', { with: { type: 'json' } });
    spoilsCardLibrary = spoilsCardLibraryModule.default as unknown as Record<string, CardNoId>;
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[dark-ages configurator - configuring spoils] failed to load spoils library`);
      return;
    }
  }
  
  args.config.nonSupply ??= [];
  
  const cardData = createCardData('spoils', 'dark-ages', {
    ...spoilsCardLibrary['spoils'] ?? {},
    partOfSupply: false,
    tags: ['spoils'],
  });
  
  args.config.nonSupply.push({
    name: 'spoils',
    cards: new Array(15).fill({ ...cardData }),
  });
  
  console.log(`[dark-ages configurator - configuring spoils] spoils configured`);
};