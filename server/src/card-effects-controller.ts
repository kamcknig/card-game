import { EffectGenerator, IEffectRunner } from "./types.ts";
import { GameEffects } from "./effects/game-effects.ts";
import { Match, MatchUpdate } from "shared/shared-types.ts";
import { effectGeneratorMap } from "./effect-generator-map.ts";
import { EffectsPipeline } from "./effects-pipeline.ts";
import { CardLibrary } from "./match-controller.ts";

export class CardEffectController implements IEffectRunner {
  private _effectsPipeline: EffectsPipeline | undefined;

  constructor(
    private readonly _cardLibrary: CardLibrary,
  ) {
  }

  public endGame() {
  }

  public async runGameActionEffects(
    effectName: string,
    match: Match,
    playerId: number,
    cardId?: number,
  ): Promise<unknown> {
    const generatorFn = effectGeneratorMap[effectName];
    if (!generatorFn) {
      console.log(
        `[EFFECT CONTROLLER] No effect generator found for game event ${effectName}`,
      );
      return;
    }
    console.log(
      `[EFFECT CONTROLLER] running game action effect generator for ${effectName}`,
    );
    const gen = await generatorFn({
      match,
      cardLibrary: this._cardLibrary,
      triggerPlayerId: playerId,
      triggerCardId: cardId,
    });
    return this.runGenerator(gen, match, playerId);
  }

  public async runCardEffects(
    match: Match,
    playerId: number,
    cardId: number,
    acc: MatchUpdate,
    reactionContext?: unknown,
  ): Promise<unknown> {
    const card = this._cardLibrary.getCard(cardId);
    const generatorFn = effectGeneratorMap[card?.cardKey ?? ""];
    if (!generatorFn) {
      console.log(`[EFFECT CONTROLLER] No effect generator found for ${card}`);
      return;
    }
    console.log(`[EFFECT CONTROLLER] running effect generator for ${card}`);
    const gen = await generatorFn({
      match,
      cardLibrary: this._cardLibrary,
      triggerCardId: cardId,
      triggerPlayerId: playerId,
      reactionContext,
    });
    return this.runGenerator(gen, match, playerId, acc);
  }

  public async runGenerator(
    generator: EffectGenerator<GameEffects>,
    match: Match,
    playerId: number,
    acc?: MatchUpdate,
  ) {
    if (!generator) {
      console.log(`[EFFECT CONTROLLER] No effect generator found`);
      return;
    }

    if (!this._effectsPipeline) {
      console.warn(
        "[EFFECT CONTROLLER] EffectPipeline not assigned to CardEffectController; skipping generator",
      );
      return;
    }

    return await this._effectsPipeline.runGenerator(
      generator,
      match,
      playerId,
      acc,
    );
  }

  public async suspendedCallbackRunner(fn: () => Promise<void>): Promise<void> {
    console.log(
      `[EFFECT CONTROLLER] running complete callback suspended effects`,
    );
    if (this._effectsPipeline) {
      await this._effectsPipeline.suspendCallback(fn);
    } else {
      console.warn(
        "[EFFECT CONTROLLER] EffectPipeline not assigned to CardEffectController",
      );
      await fn();
    }
  }

  public setEffectPipeline(pipeline: EffectsPipeline) {
    this._effectsPipeline = pipeline;
  }
}
