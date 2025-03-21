import {PreinitializedWritableAtom} from 'nanostores';
import {GameEffects} from './effect.ts';
import {AppSocket, EffectGenerator, EffectHandlerMap, EffectHandlerResult} from "./types.ts";
import {Match, MatchUpdate} from "shared/types.ts";
import {sendToSockets} from "./utils/send-to-sockets.ts";
import { isUndefined } from "es-toolkit";

export class EffectsPipeline {
    constructor(
        private effectHandlerMap: EffectHandlerMap,
        private readonly $matchState: PreinitializedWritableAtom<Partial<Match>>,
        private readonly sockets: AppSocket[],
    ) {}

    public async runGenerator(generator: EffectGenerator<GameEffects>, match: Match, acc?: MatchUpdate): EffectHandlerResult {
        const topLevel = isUndefined(acc);
        acc ??= {};
        
        let nextEffect = generator.next();
        
        while (!nextEffect.done) {
            const effect = nextEffect.value as GameEffects;

            const handler = this.effectHandlerMap[effect.type];
            if (!handler) {
                console.error(`No handler for effect type: ${effect.type}`);
                nextEffect = generator.next();
                continue;
            }
            
            const effectResults = await handler(effect as unknown as any, match, acc);
            
            nextEffect = generator.next(effectResults.results);
        }
        
        if (topLevel && Object.keys(acc).length > 0) {
            sendToSockets(this.sockets.values(), 'matchUpdated', acc);
            this.$matchState.set(match);
        }
        
        return { match, results: (nextEffect.value as any)?.results };
    }
}
