import { GameEffects } from './effects/game-effects.ts';
import { AppSocket, EffectGenerator, EffectHandlerMap } from './types.ts';
import { Match, PlayerId } from 'shared/shared-types.ts';
import { compare, Operation } from 'fast-json-patch';

export class EffectsPipeline {
  private _suspendEffectCallback: boolean = false;
  private _prevSnapshot!: Match;

  constructor(
    private readonly _effectHandlerMap: EffectHandlerMap,
    private readonly _socketMap: Map<PlayerId, AppSocket>,
    private readonly _effectCompletedCallback: () => void,
  ) {}
  
  /**
   * Compute JSON‑Patch diff and broadcast to every connected socket.
   */
  private flushPatch(match: Match) {
    const patch: Operation[] = compare(this._prevSnapshot, match);
    if (patch.length === 0) return;
    
    this._socketMap.forEach((s) => s.emit("matchPatch", patch));
    this._prevSnapshot = structuredClone(match);
  }
  
  public async runGenerator(
    generator: EffectGenerator<GameEffects>,
    match: Match,
    playerId: number,
  ): Promise<unknown> {
    if (!this._prevSnapshot) {
      this._prevSnapshot = structuredClone(match);
    }

    let nextEffect = generator.next();
    while (!nextEffect.done) {
      const effect = nextEffect.value as GameEffects;
      const handler = this._effectHandlerMap[effect.type];
      if (!handler) {
        console.error(`[EFFECT PIPELINE] '${effect.type}' effect handler not found`,);
        nextEffect = generator.next();
        continue;
      }

      console.log(`[EFFECT PIPELINE] running '${effect.type}' effect handler`);

      const result = await handler(effect as unknown as any, match);
      
      // Flush patch so clients update mid‑turn
      this.flushPatch(match);
      
      nextEffect = generator.next(result);
    }
    
    // Top‑level generator finished
    if (!this._suspendEffectCallback) {
      this._effectCompletedCallback();
      this.flushPatch(match);
    }
    
    this._socketMap.get(playerId)?.emit("cardEffectsComplete");
    return nextEffect.value;
  }

  public async suspendCallback(fn: () => Promise<void>) {
    console.log(`[EFFECT PIPELINE] suspending call back to run function`);
    this._suspendEffectCallback = true;
    await fn();
    console.log(`[EFFECT PIPELINE] un-suspending call back`);
    // Ensure any queued changes are sent once the suspension ends
    this.flushPatch(this._prevSnapshot);
    this._effectCompletedCallback();
  }
}
