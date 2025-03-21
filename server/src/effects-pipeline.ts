import {PreinitializedWritableAtom} from 'nanostores';
import {GameEffects} from './effect.ts';
import {AppSocket, EffectGenerator, EffectHandlerMap, EffectHandlerResult} from "./types.ts";
import {Match, MatchUpdate} from "shared/types.ts";
import {sendToSockets} from "./utils/send-to-sockets.ts";

export class EffectsPipeline {
    constructor(
        private effectHandlerMap: EffectHandlerMap,
        private readonly $matchState: PreinitializedWritableAtom<Partial<Match>>,
        private readonly sockets: AppSocket[],
    ) {}

    public async runGenerator(generator: EffectGenerator<GameEffects>, match: Match): EffectHandlerResult {
        let nextEffect = generator.next();
        let rollingMatchUpdate: MatchUpdate = {};

        while (!nextEffect.done) {
            const effect = nextEffect.value as GameEffects;

            const handler = this.effectHandlerMap[effect.type];
            if (!handler) {
                console.error(`No handler for effect type: ${effect.type}`);
                nextEffect = generator.next();
                continue;
            }
            
            const effectResults = await handler(effect as unknown as any, match);
            rollingMatchUpdate = {
                ...rollingMatchUpdate,
                ...effectResults.match
            };
            
            match = {
                ...match,
                ...rollingMatchUpdate,
            }
            
            nextEffect = generator.next(effectResults);
        }
        
        if (Object.keys(rollingMatchUpdate).length > 0) {
            sendToSockets(this.sockets.values(), 'matchUpdated', rollingMatchUpdate);
            this.$matchState.set(match);
        }
        
        return { match, results: (nextEffect.value as any)?.results };
    }
}
