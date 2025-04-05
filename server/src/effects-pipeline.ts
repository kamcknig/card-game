import { GameEffects } from './effects/game-effects.ts';
import { AppSocket, EffectGenerator, EffectHandlerMap, } from './types.ts';
import { Match, MatchUpdate, PlayerID } from 'shared/shared-types.ts';
import { isUndefined } from 'es-toolkit';

export class EffectsPipeline {
  private _suspendEffectCallback: boolean = false;

  constructor(
    private readonly _effectHandlerMap: EffectHandlerMap,
    private readonly match: Match,
    private readonly _socketMap: Map<PlayerID, AppSocket>,
    private readonly _effectCompletedCallback: () => void,
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
        console.error(`[EFFECT PIPELINE] '${effect.type}' effect handler not found`);
        nextEffect = generator.next();
        continue;
      }

      console.log(`[EFFECT PIPELINE] running '${effect.type}' effect handler`);
      
      effectResults = await handler(effect as unknown as any, match, acc);

      nextEffect = generator.next(effectResults);
    }

    if (topLevel) {
      console.log(`[EFFECT PIPELINE] topLevel effect pipeline completed`);
      if (!this._suspendEffectCallback) {
        this._effectCompletedCallback()
      } else {
        console.log(`[EFFECT PIPELINE] effect completion is suspended, not invoking completed callback`,);
      }
    }

    this._socketMap.get(playerId)?.emit("cardEffectsComplete");
    return nextEffect.value;
  }

  public async suspendCallback(fn: () => Promise<void>) {
    console.log(`[EFFECT PIPELINE] suspending call back to run function`);
    this._suspendEffectCallback = true;
    await fn();
    console.log(`[EFFECT PIPELINE] un-suspending call back`);
    this._suspendEffectCallback = false;
    this._effectCompletedCallback();
  }
}
