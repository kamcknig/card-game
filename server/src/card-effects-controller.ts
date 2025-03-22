import {EffectGenerator, EffectHandlerResult, IEffectRunner} from "./types.ts";
import {PreinitializedWritableAtom} from "nanostores";
import {GameEffects} from './effect.ts';
import { Match, MatchUpdate } from "shared/types.ts";
import { effectGeneratorMap } from './effect-generator-map.ts';

export class CardEffectController implements IEffectRunner {
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
        console.log('running game action effects for', effectName);
        const gen = await generatorFn(match, playerId, cardId);
        return this.runGenerator(gen, match);
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
        console.log(`running game action for ${card}`);
        const gen = await generatorFn(match, playerId, cardId, reactionContext);
        return this.runGenerator(gen, match, acc);
    }

    public async runGenerator(generator: EffectGenerator<GameEffects>, match: Match, acc?: MatchUpdate) {
        if (!generator) {
            console.log(`No effect generator found`);
            return;
        }

        if (this.runGeneratorImpl) {
            await this.runGeneratorImpl(generator, match, acc);
        } else {
            console.warn("No runGenerator set on CardEffectController; skipping generator");
        }
    }

    private runGeneratorImpl?: (gen: EffectGenerator<GameEffects>, match: Match, acc?: MatchUpdate) => EffectHandlerResult;

    public setRunGenerator(fn: (gen: EffectGenerator<GameEffects>, match: Match, acc?: MatchUpdate) => EffectHandlerResult) {
        this.runGeneratorImpl = fn;
    }
}
