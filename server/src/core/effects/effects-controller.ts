import {
  GameActionEffectGeneratorFn,
  GameActions,
  GameActionTypes,
  GameEffectGenerator,
  IEffectRunner,
  SourceContext
} from '../../types.ts';
import { EffectsPipeline } from './effects-pipeline.ts';

import { CardLibrary } from '../card-library.ts';
import { CardId, Match, PlayerId } from 'shared/shared-types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { EventSystem, GameEvent } from '../events/event-system.ts';

export class EffectsController implements IEffectRunner {
  private _effectsPipeline: EffectsPipeline | undefined;
  
  constructor(
    private readonly eventSystem: EventSystem,
    private readonly match: Match,
    private readonly _effectGeneratorMap: Record<GameActionTypes, GameActionEffectGeneratorFn>,
    private readonly _cardLibrary: CardLibrary,
  ) {
  }
  
  public endGame() {
  }
  
  public async runGameActionEffects<T extends GameActionTypes>(
    args: GameActions[T] extends undefined
      ? { effectName: T }
      : { effectName: T; context: GameActions[T] }
  ): Promise<unknown> {
    const { effectName } = args;
    
    let c = {};
    if ('context' in args) {
      c = args.context
    }
    
    // const source = context?.source;
    const generatorFn = this._effectGeneratorMap[effectName];
    
    if (!generatorFn) {
      console.log(`[EFFECT CONTROLLER] '${effectName}' game action effects generator not found`,);
      return;
    }
    
    console.log(`[EFFECT CONTROLLER] running '${effectName}' game action effect generator`,);
    
    // For specific effects that can trigger reactions, handle them here
    if (effectName === 'playCard' && 'cardId' in c) {
      const card = this._cardLibrary.getCard(c.cardId as CardId);
      if (card.type.includes('ATTACK')) {
        // Create an event for the attack
        const attackEvent: GameEvent = {
          type: 'attackPlayed',
          playerId: (c as any).playerId as PlayerId,
          cardId: c.cardId as CardId,
          targetIds: findOrderedTargets({
            startingPlayerId: (c as any).playerId as PlayerId,
            appliesTo: 'ALL_OTHER',
            match: this.match
          })
        };
        
        // Process reactions before continuing with the effect
        const reactionResults = await this.eventSystem.processEvent(attackEvent);
        
        // Add reaction results to context so the generator can use them
        c = {
          ...c,
          reactionResults
        };
      }
    }
    
    const generator = generatorFn({ ...c });
    return this.runGenerator({ generator, ...c });
  }
  
  public runCardEffects(arg: {
    reactionContext?: unknown,
    source: Extract<SourceContext, { type: 'card' }>;
  }): unknown {
    const { source, reactionContext } = arg;
    const card = this._cardLibrary.getCard(source.cardId);
    const generatorFn = this._effectGeneratorMap[card?.cardKey ?? ''];
    
    if (!generatorFn) {
      console.log(`[EFFECT CONTROLLER] No card effects generator found for ${card}`);
      return;
    }
    
    console.log(`[EFFECT CONTROLLER] running card effects generator for ${card}`);
    
    const generator = generatorFn({
      source,
      reactionContext,
    });
    
    return this.runGenerator({ generator, source });
  }
  
  public runGenerator(arg: {
    generator: GameEffectGenerator,
    source?: SourceContext,
    onComplete?: () => void
  }): unknown {
    const { generator, source, onComplete } = arg;
    
    if (!generator) {
      console.log(`[EFFECT CONTROLLER] No anonymous effects generator supplied`);
      return;
    }
    
    if (!this._effectsPipeline) {
      console.warn('[EFFECT CONTROLLER] EffectPipeline not assigned to CardEffectController; skipping generator',);
      return;
    }
    
    return this._effectsPipeline.runGenerator({
      generator,
      source,
      onComplete
    });
  }
  
  public setEffectPipeline(pipeline: EffectsPipeline) {
    this._effectsPipeline = pipeline;
  }
}
