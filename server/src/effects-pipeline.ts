import {PreinitializedWritableAtom} from 'nanostores';
import { GameEffects } from './effect.ts';
import {AppSocket, EffectGenerator, EffectHandlerMap, EffectHandlerResult} from "./types.ts";
import {Match, MatchUpdate} from "shared/types.ts";
import {sendToSockets} from "./utils/send-to-sockets.ts";
import { isUndefined } from "es-toolkit";
import { playerSocketMap } from './player-socket-map.ts';

export class EffectsPipeline {
    private _suspendEffectCallback: boolean = false;
    constructor(
        private effectHandlerMap: EffectHandlerMap,
        private readonly $matchState: PreinitializedWritableAtom<Partial<Match>>,
        private readonly sockets: AppSocket[],
    ) {}

    public async runGenerator(
      generator: EffectGenerator<GameEffects>,
      match: Match,
      playerId: number,
      acc?: MatchUpdate
    ): EffectHandlerResult {
        const topLevel = isUndefined(acc);
        acc ??= {};
        
        let effectResults;
        let nextEffect = generator.next();
        
        while (!nextEffect.done) {
            const effect = nextEffect.value as GameEffects;

            const handler = this.effectHandlerMap[effect.type];
            if (!handler) {
                console.error(`No handler for effect type: ${effect.type}`);
                nextEffect = generator.next();
                continue;
            }
            
            console.log(`running effect handler for ${effect.type}`);
            effectResults = await handler(effect as unknown as any, match, acc);
            
            if (effect.triggerImmediateUpdate) {
                sendToSockets(this.sockets.values(), 'matchUpdated', acc);
            }
            
            nextEffect = generator.next(effectResults);
        }
        
        if (topLevel) {
            !this._suspendEffectCallback && this.effectCompleted(match, acc);
        }
        
        const playerSocket = playerSocketMap.get(playerId)
        if (!isUndefined(playerSocket)) {
            sendToSockets([playerSocket].values(), 'cardEffectsComplete');
        }
        
        return nextEffect.value;
    }
    
    public async suspendCallback(fn: () => Promise<void>) {
        this._suspendEffectCallback = true;
        await fn();
        this._suspendEffectCallback = false;
    }
    
    private effectCompleted(match: Match, acc: MatchUpdate) {
        if (Object.keys(acc).length > 0) {
            sendToSockets(this.sockets.values(), 'matchUpdated', acc);
            this.$matchState.set({ ...match });
        }
    }
}
