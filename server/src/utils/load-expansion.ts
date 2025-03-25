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
        const configModule = await import(`${expansionPath}/configuration.json`, { with: { type: 'json' }});
        const expansionConfiguration = configModule.default;
        console.log(`expansion configuration loaded`);
        
        console.log('loading supply');
        let module = await import(`${expansionPath}/${expansionConfiguration.supply}`, { with: { type: 'json' }});
        let cards = module.default as Record<string, CardData>;
        Object.keys(cards).forEach((key) => {
            cardLibrary.supply[key] = cards[key];
        });
        console.log('supply loaded');

        console.log('loading kingdom');
        module = await import(`${expansionPath}/${expansionConfiguration.kingdom}`, { with: { type: 'json' }});
        cards = module.default as Record<string, CardData>;
        Object.keys(cards).forEach((key) => {
            cardLibrary.kingdom[key] = cards[key];
        });
        console.log('kingdom loaded');

        console.log('loading card effects');
        module = await import(`${expansionPath}/card-effects.ts`);
        const effects = module.default.registerEffects();
        Object.keys(effects).forEach(key => {
            console.log('registering effects for', key);
            effectGeneratorMap[key] = effects[key];
        });
        console.log('card effects loaded', effectGeneratorMap);

        console.log('loading card lifecycles');
        const cardLifeCycles = module.default.registerCardLifeCycles();
        Object.keys(cardLifeCycles).forEach(key => {
            console.log('registering card lifecycle', key);
            cardLifecycleMap[key] = cardLifeCycles[key];
        });
        console.log('card lifecycles loaded', cardLifecycleMap);

        console.log('registering scoring functions');
        const scoringFunctions = module.default.registerScoringFunctions();
        Object.keys(scoringFunctions).forEach(key => {
            console.log('registering scoring function for', key);
            scoringFunctionMap[key] = scoringFunctions[key];
        });
        console.log('scoring functions registered');

    } catch (error) {
        console.error(`Failed to load expansion: ${expansionName}`, error);
        return {};
    }
};
