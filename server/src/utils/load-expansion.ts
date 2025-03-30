import { CardData } from "../types.ts";
import { cardLifecycleMap, effectGeneratorMap } from '../effect-generator-map.ts';
import { scoringFunctionMap } from '../scoring-function-map.ts';

export const cardLibrary: { supply: Record<string, CardData>; kingdom: Record<string, CardData> } = {
    supply: {},
    kingdom: {},
};

export const loadExpansion = async (expansionName: string) => {
    console.log('loading expansion', expansionName);
    const expansionPath = `../expansions/${expansionName}`;
    
    try {
        console.log(`loading expansion configuration for ${expansionName}`);
        const configModule = await import(`${expansionPath}/configuration.json`, { with: { type: 'json' }});
        const expansionConfiguration = configModule.default;
        console.log(`expansion configuration loaded`);
        
        
        
        console.log(`loading supply card library for ${expansionName}`);
        let module = await import(`${expansionPath}/${expansionConfiguration.supply}`, { with: { type: 'json' }});
        let cards = module.default as Record<string, CardData>;
        Object.keys(cards).forEach((key) => {
            cardLibrary.supply[key] = {
                ...cards[key],
                expansionName,
                imagePath: `./assets/card-images/base-supply/full-size/${key}.jpg`,
                halfImagePath: `./assets/card-images/base-supply/half-size/${key}.jpg`
            };
        });
        console.log('supply loaded');

        
        
        console.log(`loading kingdom car library for ${expansionName}`);
        module = await import(`${expansionPath}/${expansionConfiguration.kingdom}`, { with: { type: 'json' }});
        cards = module.default as Record<string, CardData>;
        Object.keys(cards).forEach((key) => {
            cardLibrary.kingdom[key] = {
                ...cards[key],
                expansionName,
                imagePath: `./assets/card-images/${expansionName}/full-size/${key}.jpg`,
                halfImagePath: `./assets/card-images/${expansionName}/half-size/${key}.jpg`,
            };
        });
        console.log('kingdom loaded');

        
        
        console.log('loading base supply card effects');
        module = await import(`../expansions/base-supply-card-effects.ts`);
        let effects = module.default.registerEffects();
        Object.keys(effects).forEach(key => {
            console.debug('registering effects for', key);
            effectGeneratorMap[key] = effects[key];
        });
        console.log('base supply card effects loaded');
        
        
        
        console.log(`loading ${expansionName} card effects`);
        module = await import(`${expansionPath}/card-effects.ts`);
        effects = module.default.registerEffects();
        Object.keys(effects).forEach(key => {
            console.debug('registering effects for', key);
            effectGeneratorMap[key] = effects[key];
        });
        console.log(`card effects loaded for ${expansionName}`, effectGeneratorMap);

        
        
        
        console.log('loading card lifecycles');
        const cardLifeCycles = module.default.registerCardLifeCycles();
        Object.keys(cardLifeCycles).forEach(key => {
            console.debug('registering card lifecycle', key);
            cardLifecycleMap[key] = cardLifeCycles[key];
        });
        console.log('card lifecycles loaded', cardLifecycleMap);

        
        
        
        console.log('registering scoring functions');
        const scoringFunctions = module.default.registerScoringFunctions();
        Object.keys(scoringFunctions).forEach(key => {
            console.debug('registering scoring function for', key);
            scoringFunctionMap[key] = scoringFunctions[key];
        });
        console.log('scoring functions registered');

    } catch (error) {
        console.error(`Failed to load expansion: ${expansionName}`, error);
        return {};
    }
};
