import { GameEffects } from './effects/game-effects.ts';
import { AppSocket, EffectGenerator, EffectHandlerMap } from '../types.ts';
import { Match, PlayerId } from 'shared/shared-types.ts';
import { MatchController } from './match-controller.ts';

export class EffectsPipeline {
  private _prevSnapshot!: Match;

  constructor(
    private readonly _effectHandlerMap: EffectHandlerMap,
    private readonly _socketMap: Map<PlayerId, AppSocket>,
    private readonly _effectCompletedCallback: () => void,
    private readonly _matchController: MatchController,
    private readonly _match: Match,
  ) {}
  
  public async runGenerator(
    generator: EffectGenerator<GameEffects>,
    playerId: number,
  ): Promise<unknown> {
    if (!this._prevSnapshot) {
      this._prevSnapshot = this._matchController.getMatchSnapshot();
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

      const result = await handler(effect as unknown as any, this._match);
      
      this.flushChanges();
      
      nextEffect = generator.next(result);
    }
    
    this._effectCompletedCallback();
    
    this._socketMap.get(playerId)?.emit("cardEffectsComplete");
    return nextEffect.value;
  }

  public flushChanges() {
    this._matchController.broadcastPatch(this._prevSnapshot);
    this._prevSnapshot = this._matchController.getMatchSnapshot();
  }
}
