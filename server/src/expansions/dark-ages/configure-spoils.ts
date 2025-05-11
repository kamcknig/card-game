import { CardNoId } from "shared/shared-types.ts";
import { ExpansionConfiguratorContext } from '../../types.ts';
import { createCardData } from '../../utils/create-card-data.ts';

export const configureSpoils = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomCards.some(card => ['marauder', 'pillage', 'bandit-camp'].includes(card.cardKey))) {
    return;
  }
  
  if (args.config.nonSupplyCards?.some(card => card.tags?.includes('spoils'))) {
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
  
  args.config.nonSupplyCards ??= [];
  args.config.nonSupplyCardCount ??= {};
  
  for (const key of Object.keys(spoilsCardLibrary ?? {})) {
    const cardData = createCardData(key, 'dark-ages', {
      ...spoilsCardLibrary[key] ?? {},
      tags: ['spoils'],
    });
    args.config.nonSupplyCards.push(cardData)
    args.config.nonSupplyCardCount[key] = args.config.players.length > 2 ? 2 : 1;
  }
  
  console.log(`[dark-ages configurator - configuring spoils] spoils configured`);
};