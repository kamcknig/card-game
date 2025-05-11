import { cardEffectFunctionMapFactory } from '../core/effects/card-effect-function-map-factory.ts';
import { scoringFunctionMap } from '@expansions/scoring-function-map.ts';
import { expansionLibrary, rawExpansionCardLibrary } from '@expansions/expansion-library.ts';
import { cardLifecycleMap } from '../core/card-lifecycle-map.ts';
import { CardExpansionModule } from '../types.ts';
import { CardNoId } from 'shared/shared-types.ts';
import { cardActionConditionMapFactory } from '../core/actions/card-action-condition-map-factory.ts';
import { createCardData } from './create-card-data.ts';

export const loadExpansion = async (expansion: { name: string; }) => {
  const expansionPath = `@expansions/${expansion.name}`;
  const expansionName = expansion.name;
  if (expansionLibrary[expansionName]) {
    console.log(`[expansion loader] expansion ${expansionName} already loaded`);
    return;
  }
  
  console.log(`[expansion loader] loading expansion ${expansionName}`);
  
  expansionLibrary[expansionName] = {
    title: expansionName,
    name: expansionName,
    cardData: {
      basicSupply: {},
      kingdomSupply: {},
    }
  };
  
  let expansionConfiguration;
  
  try {
    // loads the configuration file for the module if any
    console.log(`[expansion loader] loading expansion configuration for ${expansionName}`);
    
    const configModule = await import(`${expansionPath}/configuration-${expansionName}.json`, { with: { type: 'json' } });
    expansionConfiguration = configModule.default;
    console.log(`[expansion loader] expansion configuration loaded`);
    
    const currValue = expansionLibrary[expansionName].title;
    expansionLibrary[expansionName].title = expansionConfiguration.title ? expansionConfiguration.title : currValue;
    expansionLibrary[expansionName].mutuallyExclusive = expansionConfiguration.mutuallyExclusive ?? [];
  } catch (error) {
    if ((error as any).code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`[expansion loader] failed to load configuration for expansion ${expansionName}`);
      console.log(error);
    }
  }
  
  try {
    const cardData = expansionLibrary[expansionName].cardData;
    
    console.log(`[expansion loader] loading card library for ${expansionName}`);
    const cardLibraryModule = await import(`${expansionPath}/card-library-${expansionName}.json`, { with: { type: 'json' } });
    const cards = cardLibraryModule.default as Record<string, Partial<CardNoId>>;
    for (const key of Object.keys(cards)) {
      const newCardData = createCardData(key, expansionName, cards[key]);
      
      const isBasic = newCardData.isBasic;
      cardData[isBasic ? 'basicSupply' : 'kingdomSupply'][key] = newCardData as any;
      rawExpansionCardLibrary[key] = newCardData as any;
    }
    console.log('[expansion loader] card library loaded');
    
    console.log(`[expansion loader] loading ${expansionName} card effects`);
    const cardEffectsModule = await import(`${expansionPath}/card-effects-${expansionName}.ts`);
    const cardEffects = cardEffectsModule.default as CardExpansionModule;
    
    Object.keys(cardEffects).forEach(key => {
      if (cardEffects[key].registerScoringFunction) {
        console.log(`[expansion loader] registering scoring function for ${key}`);
        scoringFunctionMap[key] = cardEffects[key].registerScoringFunction();
      }
      
      if (cardEffects[key].registerLifeCycleMethods) {
        console.log(`[expansion loader] registering lifecycle methods for ${key}`);
        cardLifecycleMap[key] = cardEffects[key].registerLifeCycleMethods()
      }
      
      if (cardEffects[key].registerEffects) {
        console.log(`[expansion loader] registering effects for ${key}`);
        cardEffectFunctionMapFactory[key] = cardEffects[key].registerEffects;
      }
      
      if (cardEffects[key].registerActionConditions) {
        cardActionConditionMapFactory[key] = cardEffects[key].registerActionConditions()
      }
    });
    console.log('[expansion loader] base supply card effects loaded');
  } catch (error) {
    console.warn(`[expansion loader] Failed to load expansion: ${expansionName}`);
    console.log(error);
    delete expansionLibrary[expansionName];
  }
};
