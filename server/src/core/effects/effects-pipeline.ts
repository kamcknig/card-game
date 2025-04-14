import { GameEffects } from './effect-types/game-effects.ts';
import { AppSocket, EffectGenerator, EffectHandlerMap } from '../../types.ts';
import { Match, PlayerId } from 'shared/shared-types.ts';
import { MatchController } from '../match-controller.ts';

export class EffectsPipeline {
  private _prevSnapshot!: Match;
  private _pausedGenerators = new Map<string, {
    generator: EffectGenerator<GameEffects>;
    playerId?: PlayerId;
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
  
  public runGenerator(args: {
    generator: EffectGenerator<GameEffects>,
    playerId?: number,
    cardId?: number,
    resumeInput?: unknown,
    resumeSignalId?: string,
    onComplete?: () => void,
  }): unknown {
    this._prevSnapshot = this._matchController.getMatchSnapshot();
    const { onComplete, resumeInput, resumeSignalId, generator, playerId, cardId } = args;
    
    let nextEffect = resumeInput !== undefined && resumeSignalId
      ? generator.next(resumeInput)
      : generator.next();
    
    while (!nextEffect.done) {
      const effect = nextEffect.value as GameEffects;
      const handler = this._effectHandlerMap[effect.type];
      let result: any;
      
      if (!handler) {
        console.warn(`[EFFECT PIPELINE] '${effect.type}' effect handler not found`);
      } else {
        console.log(`[EFFECT PIPELINE] running '${effect.type}' effect`);
        
        result = handler(effect as unknown as any, this._match);
        
        if (result !== undefined) {
          // pauses the current generator, usually to await input from the user
          if ('pause' in result) {
            const { signalId } = result;
            console.log(`[EFFECT PIPELINE] pausing effect generator with signal ${signalId}`);
            
            this._pausedGenerators.set(signalId, {
              generator,
              playerId,
              resolve: (input: unknown) =>
                this.runGenerator({ generator, playerId, cardId, resumeInput: input, resumeSignalId: signalId, onComplete })
            });
            
            // return because we are 'pausing' the generator
            return;
          } else if ('runGenerator' in result) {
            // runs a generator returned from the handler
            this.runGenerator({ generator: result.runGenerator, playerId, cardId });
            
            // continue with the outer generator
            nextEffect = generator.next();
            continue;
          }
        }
      }
      
      this.flushChanges();
      nextEffect = generator.next(result);
    }
    
    this.flushChanges();
    onComplete?.();
    this._effectCompletedCallback();
    
    if (playerId) {
      this._socketMap.get(playerId!)?.emit('cardEffectsComplete', playerId, cardId);
    }
    
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
