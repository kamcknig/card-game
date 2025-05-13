import { CardNoId } from "shared/shared-types.ts";
import { ExpansionConfiguratorContext } from '../../types.ts';
import { createCardData } from '../../utils/create-card-data.ts';
import { rawCardLibrary } from '../expansion-library.ts';

export const configureShelters = async (args: ExpansionConfiguratorContext) => {
  const idx = Math.floor(Math.random() * args.config.kingdomSupply.length);
  
  if (args.config.kingdomSupply[idx].cards[0].expansionName !== 'dark-ages') {
    return;
  }
  
  console.log(`[dark-ages configurator - configuring shelters] shelters needs to be configured`);
  
  let sheltersCardLibrary: Record<string, CardNoId> = {};
  
  try {
    const sheltersCardLibraryModule = await import('./card-library-shelters.json', { with: { type: 'json' } });
    sheltersCardLibrary = sheltersCardLibraryModule.default as unknown as Record<string, CardNoId>;
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[dark-ages configurator - configuring shelters] failed to load shelters library`);
      return;
    }
  }
  
  delete args.config.playerStartingHand['estate'];
  
  for (const key of ['hovel', 'necropolis', 'overgrown-estate']) {
    const cardData = createCardData(key, 'dark-ages', {
      ...sheltersCardLibrary[key] ?? {},
      partOfSupply: false,
      tags: ['shelters'],
    });
    
    rawCardLibrary[key] = cardData;
    
    args.config.playerStartingHand[key] = 1;
  }
};