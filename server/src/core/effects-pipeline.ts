import { GameEffects } from './effects/game-effects.ts';
import { AppSocket, EffectGenerator, EffectHandlerMap } from '../types.ts';
import { Match, PlayerId } from 'shared/shared-types.ts';
import { MatchController } from './match-controller.ts';

export class EffectsPipeline {
  private _prevSnapshot!: Match;
  private _pausedGenerators = new Map<string, {
    generator: EffectGenerator<GameEffects>;
    playerId: PlayerId;
    resolve: (input: unknown) => void;
  }>();
  
  constructor(
    private readonly _effectHandlerMap: EffectHandlerMap,
    private readonly _socketMap: Map<PlayerId, AppSocket>,
    private readonly _effectCompletedCallback: () => void,
    private readonly _matchController: MatchController,
    private readonly _match: Match,
  ) {
  }
  
  public runGenerator(
    generator: EffectGenerator<GameEffects>,
    playerId: number,
    cardId?: number,
    resumeInput?: unknown,
    resumeSignalId?: string,
  ): unknown {
    this._prevSnapshot = this._matchController.getMatchSnapshot();
    
    let nextEffect = resumeInput !== undefined && resumeSignalId
      ? generator.next(resumeInput)
      : generator.next();
    
    while (!nextEffect.done) {
      const effect = nextEffect.value as GameEffects;
      const handler = this._effectHandlerMap[effect.type];
      
      if (!handler) {
        console.error(
          `[EFFECT PIPELINE] '${effect.type}' effect handler not found`,
        );
        nextEffect = generator.next();
        continue;
      }
      
      console.log(`[EFFECT PIPELINE] running '${effect.type}' effect`);
      
      const result = handler(effect as unknown as any, this._match);
      
      if (result !== undefined && 'pause' in result) {
        const { signalId } = result;
        console.log(`[EFFECT PIPELINE] pausing effect generator with signal ${signalId}`);
        
        this._pausedGenerators.set(signalId, {
          generator,
          playerId,
          resolve: (input: unknown) => {
            void this.runGenerator(generator, playerId, cardId, input, signalId);
          },
        });
        
        return; // Pause and wait for resumeGenerator
      }
      
      this.flushChanges();
      nextEffect = generator.next(result);
    }
    
    this._effectCompletedCallback();
    
    this._socketMap.get(playerId)?.emit('cardEffectsComplete', playerId, cardId);
    return nextEffect.value;
  }
  
  public resumeGenerator(signalId: string, userInput: unknown): void {
    console.log(`[EFFECT PIPELINE] resuming generator for signal ${signalId}`);
    console.log(`[EFFECT PIPELINE] resumed input ${userInput}`);
    const paused = this._pausedGenerators.get(signalId);
    if (!paused) {
      console.log(`[EFFECT PIPELINE] could not find paused generator for signal ${signalId}`);
      return;
    }
    
    this._pausedGenerators.delete(signalId);
    paused.resolve(userInput);
  }
  
  public flushChanges() {
    if (!this._prevSnapshot) return;
    this._matchController.broadcastPatch(this._prevSnapshot);
    this._prevSnapshot = this._matchController.getMatchSnapshot();
  }
}
