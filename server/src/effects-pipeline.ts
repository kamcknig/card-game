import { PreinitializedWritableAtom } from "nanostores";
import { GameEffects } from "./effects/game-effects.ts";
import {
  AppSocket,
  EffectGenerator,
  EffectHandlerMap,
  
} from "./types.ts";
import { Match, MatchUpdate, PlayerID } from 'shared/shared-types.ts';
import { isUndefined } from "es-toolkit";

export class EffectsPipeline {
  private _suspendEffectCallback: boolean = false;

  constructor(
    private readonly _effectHandlerMap: EffectHandlerMap,
    private readonly _$matchState: PreinitializedWritableAtom<Partial<Match>>,
    private readonly _socketMap: Map<PlayerID, AppSocket>,
  ) {}

  public async runGenerator(
    generator: EffectGenerator<GameEffects>,
    match: Match,
    playerId: number,
    acc?: MatchUpdate,
  ): Promise<unknown> {
    const topLevel = isUndefined(acc);
    acc ??= {};

    let effectResults;
    let nextEffect = generator.next();

    while (!nextEffect.done) {
      const effect = nextEffect.value as GameEffects;

      const handler = this._effectHandlerMap[effect.type];
      if (!handler) {
        console.error(
          `[EFFECT PIPELINE] No handler for effect type: ${effect.type}`,
        );
        nextEffect = generator.next();
        continue;
      }

      console.log(
        `[EFFECT PIPELINE] running effect handler for ${effect.type}`,
      );
      effectResults = await handler(effect as unknown as any, match, acc);

      if (effect.triggerImmediateUpdate) {
        console.debug(
          `[EFFECT PIPELINE] effect requires immediate client update`,
        );
        this._socketMap.forEach((s) => s.emit("matchUpdated", acc));
      }

      nextEffect = generator.next(effectResults);
    }

    if (topLevel) {
      if (!this._suspendEffectCallback) {
        this.effectCompleted(match, acc);
        console.debug(
          `[EFFECT PIPELINE] topLevel effect pipeline complete, send client update`,
        );
      } else {
        console.debug(
          `[EFFECT PIPELINE] topLevel effect pipeline complete but running in suspended, no update to client`,
        );
      }
    }

    this._socketMap.get(playerId)?.emit("cardEffectsComplete");
    return nextEffect.value;
  }

  public async suspendCallback(fn: () => Promise<void>) {
    console.log(`[EFFECT PIPELINE] suspending call back`);
    this._suspendEffectCallback = true;
    await fn();
    console.log(`[EFFECT PIPELINE] un-suspending call back`);
    this._suspendEffectCallback = false;
  }

  private effectCompleted(match: Match, acc: MatchUpdate) {
    console.log(`[EFFECT PIPELINE] effects runner has completed`);
    if (Object.keys(acc).length > 0) {
      this._socketMap.forEach(s => s.emit('matchUpdated', acc));
      this._$matchState.set({ ...match });
    } else {
      console.debug(
        `[EFFECT PIPELINE] effect has no updates in the partial update, not trigger match state update`,
      );
    }
  }
}
