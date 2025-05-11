import { CardNoId } from "shared/shared-types.ts";
import { ExpansionConfiguratorContext } from '../../types.ts';
import { createCardData } from '../../utils/create-card-data.ts';

export const configureRuins = async (args: ExpansionConfiguratorContext) => {
  if (!args.config.kingdomCards.some(card => card.type.includes('LOOTER'))) {
    return;
  }
  
  if (args.config.nonSupplyCards?.some(card => card.tags?.includes('ruins'))) {
    console.log(`[dark-ages configurator - configuring ruins] ruins already in kingdom, not configuring`);
    return;
  }
  
  console.log(`[dark-ages configurator - configuring ruins] ruins needs to be configured`);
  
  let ruinsCardLibrary: Record<string, CardNoId> = {};
  
  try {
    const ruinsCardLibraryModule = await import('./card-library-ruins.json', { with: { type: 'json' } });
    ruinsCardLibrary = ruinsCardLibraryModule.default as unknown as Record<string, CardNoId>;
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[dark-ages configurator - configuring ruins] failed to load ruins library`);
      return;
    }
  }
  
  args.config.kingdomCards ??= [];
  args.config.kingdomCardCount ??= {};
  
  for (const key of Object.keys(ruinsCardLibrary ?? {})) {
    const cardData = createCardData(key, 'dark-ages', {
      ...ruinsCardLibrary[key] ?? {},
      tags: ['ruins'],
    });
    args.config.kingdomCards.push(cardData)
    args.config.kingdomCardCount[key] = 1;
  }
  
  console.log(`[dark-ages configurator - configuring ruins] ruins configured`);
};