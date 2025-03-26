import {EffectGenerator, EffectHandlerResult, IEffectRunner} from "./types.ts";
import {PreinitializedWritableAtom} from "nanostores";
import {GameEffects} from './effect.ts';
import { Match, MatchUpdate } from "shared/types.ts";
import { effectGeneratorMap } from './effect-generator-map.ts';
import { EffectsPipeline } from './effects-pipeline.ts';

export class CardEffectController implements IEffectRunner {
    private _effectsPipeline: EffectsPipeline | undefined;
    
    constructor(private $matchState: PreinitializedWritableAtom<Partial<Match>>) {
    }

    public async runGameActionEffects(
        effectName: string,
        match: Match,
        playerId: number,
        cardId?: number
    ): EffectHandlerResult {
        const generatorFn = effectGeneratorMap[effectName];
        if (!generatorFn) {
            console.log(`No effect generator found for game event ${effectName}`);
            return;
        }
        console.log(`running game action effect generator for ${effectName}`);
        const gen = await generatorFn(match, playerId, cardId);
        return this.runGenerator(gen, match, playerId);
    }

    public async runCardEffects(
        match: Match,
        playerId: number,
        cardId: number,
        acc: MatchUpdate,
        reactionContext?: unknown,
    ): EffectHandlerResult {
        const cardsById = this.$matchState.get().cardsById;
        const card = cardsById?.[cardId];
        const generatorFn = effectGeneratorMap[card?.cardKey ?? ''];
        if (!generatorFn) {
            console.log(`No effect generator found for ${card}`);
            return;
        }
        console.log(`running effect generator for ${card}`);
        const gen = await generatorFn(match, playerId, cardId, reactionContext);
        return this.runGenerator(gen, match, playerId, acc);
    }
    
    
    public async runGenerator(
      generator: EffectGenerator<GameEffects>,
      match: Match,
      playerId: number,
      acc?: MatchUpdate,
    ) {
        if (!generator) {
            console.log(`No effect generator found`);
            return;
        }
        
        if (!this._effectsPipeline) {
            console.warn("EffectPipeline not assigned to CardEffectController; skipping generator");
            return;
        }
        
        return await this._effectsPipeline.runGenerator(generator, match, playerId, acc);
    }
    
    public async suspendedCallbackRunner(fn: () => Promise<void>): Promise<void> {
        console.log(`running complete callback suspended effects`)
        if (this._effectsPipeline) {
            await this._effectsPipeline.suspendCallback(fn);
        } else {
            console.warn("EffectPipeline not assigned to CardEffectController");
            await fn();
        }
    }
    
    public setEffectPipeline(pipeline: EffectsPipeline) {
        this._effectsPipeline = pipeline;
    }
}
