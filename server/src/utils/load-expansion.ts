import { CardData } from '../types.ts';
import { cardLifecycleMap, effectGeneratorMap } from '../effect-generator-map.ts';
import { scoringFunctionMap } from '../scoring-function-map.ts';
import { expansionData } from '../state/expansion-data.ts';

export const loadExpansion = async (expansion: { title: string, name: string, order: number }) => {
    const expansionPath = `../expansions/${expansion.name}`;
    const expansionName = expansion.name;
    if (expansionData[expansionName]) {
        console.log(`[EXPANSION LOADER] expansion ${expansionName} already loaded`);
        return;
    }
    
    console.log(`[EXPANSION LOADER] loading expansion ${expansionName}`);
    
    expansionData[expansionName] = {
        title: expansion.title,
        name: expansion.name,
        cardData: {},
        order: expansion.order
    };
    
    const cardData = expansionData[expansionName].cardData;
    
    try {
        console.log(`[EXPANSION LOADER] loading expansion configuration for ${expansionName}`);
        const configModule = await import(`${expansionPath}/configuration.json`, { with: { type: 'json' }});
        const expansionConfiguration = configModule.default;
        console.log(`[EXPANSION LOADER] expansion configuration loaded`);
        
        
        
        console.log(`[EXPANSION LOADER] loading supply card library for ${expansionName}`);
        let module = await import(`${expansionPath}/${expansionConfiguration.supply}`, { with: { type: 'json' }});
        let cards = module.default as Record<string, CardData>;
        Object.keys(cards).forEach((key) => {
            cardData[key] = {
                ...cards[key],
                expansionName,
                detailImagePath: `./assets/card-images/base-supply/detail/${key}.jpg`,
                fullImagePath: `./assets/card-images/base-supply/full-size/${key}.jpg`,
                halfImagePath: `./assets/card-images/base-supply/half-size/${key}.jpg`
            };
        });
        console.log('[EXPANSION LOADER] supply loaded');

        
        
        console.log(`[EXPANSION LOADER] loading kingdom car library for ${expansionName}`);
        module = await import(`${expansionPath}/${expansionConfiguration.kingdom}`, { with: { type: 'json' }});
        cards = module.default as Record<string, CardData>;
        Object.keys(cards).forEach((key) => {
            cardData[key] = {
                ...cards[key],
                expansionName,
                fullImagePath: `./assets/card-images/${expansionName}/full-size/${key}.jpg`,
                detailImagePath: `./assets/card-images/${expansionName}/detail/${key}.jpg`,
                halfImagePath: `./assets/card-images/${expansionName}/half-size/${key}.jpg`,
            };
        });
        console.log('[EXPANSION LOADER] kingdom loaded');

        
        
        console.log('[EXPANSION LOADER] loading base supply card effects');
        module = await import(`../expansions/base-supply-card-effects.ts`);
        let effects = module.default.registerEffects();
        Object.keys(effects).forEach(key => {
            console.log('registering effects for', key);
            effectGeneratorMap[key] = effects[key];
        });
        console.log('[EXPANSION LOADER] base supply card effects loaded');
        
        
        
        console.log(`[EXPANSION LOADER] loading ${expansionName} card effects`);
        module = await import(`${expansionPath}/card-effects.ts`);
        effects = module.default.registerEffects();
        Object.keys(effects).forEach(key => {
            console.log('registering effects for', key);
            effectGeneratorMap[key] = effects[key];
        });
        console.log(`[EXPANSION LOADER] card effects loaded for ${expansionName}`, effectGeneratorMap);

        
        
        
        console.log('[EXPANSION LOADER] loading card lifecycles');
        const cardLifeCycles = module.default.registerCardLifeCycles();
        Object.keys(cardLifeCycles).forEach(key => {
            console.log('registering card lifecycle', key);
            cardLifecycleMap[key] = cardLifeCycles[key];
        });
        console.log('[EXPANSION LOADER] card lifecycles loaded', cardLifecycleMap);

        
        
        
        console.log('[EXPANSION LOADER] registering scoring functions');
        const scoringFunctions = module.default.registerScoringFunctions();
        Object.keys(scoringFunctions).forEach(key => {
            console.log('registering scoring function for', key);
            scoringFunctionMap[key] = scoringFunctions[key];
        });
        console.log('[EXPANSION LOADER] scoring functions registered');

    } catch (error) {
        console.error(`[EXPANSION LOADER] Failed to load expansion: ${expansionName}`, error);
        return {};
    }
};
