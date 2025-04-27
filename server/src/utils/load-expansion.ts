import { CardData, ExpansionListElement } from 'shared/shared-types.ts';
import { cardEffectFunctionMapFactory } from '../core/effects/card-effect-function-map-factory.ts';
import { scoringFunctionMap } from '../expansions/scoring-function-map.ts';
import { expansionData } from '../state/expansion-data.ts';
import { cardLifecycleMap } from '../core/card-lifecycle-map.ts';
import { capitalize } from 'es-toolkit/compat';
import { CardExpansionModuleNew } from '../types.ts';

export const loadExpansion = async (expansion: ExpansionListElement) => {
  const expansionPath = `../expansions/${expansion.name}`;
  const expansionName = expansion.name;
  if (expansionData[expansionName]) {
    console.log(`[expansion loader] expansion ${expansionName} already loaded`);
    return;
  }
  
  console.log(`[expansion loader] loading expansion ${expansionName}`);
  
  try {
    console.log(`[expansion loader] loading expansion configuration for ${expansionName}`);
    const configModule = await import(`${expansionPath}/configuration-${expansionName}.json`, { with: { type: 'json' } });
    const expansionConfiguration = configModule.default;
    console.log(`[expansion loader] expansion configuration loaded`);
    
    expansionData[expansionName] = {
      title: expansion.title,
      name: expansion.name,
      cardData: {
        basicSupply: {},
        kingdomSupply: {},
      },
      order: expansion.order,
      mats: expansionConfiguration.mats ?? []
    };
    
    const cardData = expansionData[expansionName].cardData;
    
    console.log(`[expansion loader] loading supply card library for ${expansionName}`);
    let module = await import(`${expansionPath}/${expansionConfiguration.supply}`, { with: { type: 'json' } });
    let cards = module.default as Record<string, CardData>;
    Object.keys(cards).forEach((key) => {
      cardData.basicSupply[key] = {
        ...cards[key],
        expansionName,
        isBasic: true,
        detailImagePath: `./assets/card-images/base-supply/detail/${key}.jpg`,
        fullImagePath: `./assets/card-images/base-supply/full-size/${key}.jpg`,
        halfImagePath: `./assets/card-images/base-supply/half-size/${key}.jpg`
      };
    });
    console.log('[expansion loader] supply loaded');
    
    
    console.log(`[expansion loader] loading kingdom card library for ${expansionName}`);
    module = await import(`${expansionPath}/${expansionConfiguration.kingdom}`, { with: { type: 'json' } });
    cards = module.default as Record<string, CardData>;
    Object.keys(cards).forEach((key) => {
      cardData.kingdomSupply[key] = {
        ...cards[key],
        isKingdom: true,
        cardName: cards[key].cardName ?? capitalize(key),
        expansionName,
        fullImagePath: `./assets/card-images/${expansionName}/full-size/${key}.jpg`,
        detailImagePath: `./assets/card-images/${expansionName}/detail/${key}.jpg`,
        halfImagePath: `./assets/card-images/${expansionName}/half-size/${key}.jpg`,
      };
    });
    console.log('[expansion loader] kingdom loaded');
    
    
    console.log('[expansion loader] loading base supply card effects');
    module = await import(`../expansions/base-supply-card-effects.ts`);
    let expansionModule = module.default as CardExpansionModuleNew;
    Object.keys(expansionModule).forEach(key => {
      if (expansionModule[key].registerScoringFunction) {
        console.log(`[expansion loader] registering scoring function for ${key}`);
        scoringFunctionMap[key] = expansionModule[key].registerScoringFunction();
      }

      if (expansionModule[key].registerLifeCycleMethods) {
        console.log(`[expansion loader] registering lifecycle methods for ${key}`);
        cardLifecycleMap[key] = expansionModule[key].registerLifeCycleMethods()
      }
      
      if (expansionModule[key].registerEffects) {
        console.log(`[expansion loader] registering effects for ${key}`);
        cardEffectFunctionMapFactory[key] = expansionModule[key].registerEffects;
      }
    });
    console.log('[expansion loader] base supply card effects loaded');
    
    
    console.log(`[expansion loader] loading ${expansionName} card effects`);
    module = await import(`${expansionPath}/card-effects-${expansionName}.ts`);
    expansionModule = module.default as CardExpansionModuleNew;
    
    Object.keys(expansionModule).forEach(key => {
      if (expansionModule[key].registerScoringFunction) {
        console.log(`[expansion loader] registering scoring function for ${key}`);
        scoringFunctionMap[key] = expansionModule[key].registerScoringFunction();
      }
      
      if (expansionModule[key].registerLifeCycleMethods) {
        console.log(`[expansion loader] registering lifecycle methods for ${key}`);
        cardLifecycleMap[key] = expansionModule[key].registerLifeCycleMethods()
      }
      
      if (expansionModule[key].registerEffects) {
        console.log(`[expansion loader] registering effects for ${key}`);
        cardEffectFunctionMapFactory[key] = expansionModule[key].registerEffects;
      }
    });
    console.log('[expansion loader] base supply card effects loaded');
  } catch (error) {
    console.error(`[expansion loader] Failed to load expansion: ${expansionName}`, error);
    return {};
  }
};
