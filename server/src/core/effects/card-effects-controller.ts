import { EffectGenerator, EffectGeneratorFn, IEffectRunner } from '../types.ts';
import { GameEffects } from './effects/game-effects.ts';
import { Match } from 'shared/shared-types.ts';
import { EffectsPipeline } from './effects-pipeline.ts';

import { CardLibrary } from './card-library.ts';

export class CardEffectController implements IEffectRunner {
  private _effectsPipeline: EffectsPipeline | undefined;
  
  constructor(
    private readonly _effectGeneratorMap: Record<string, EffectGeneratorFn>,
    private readonly _cardLibrary: CardLibrary,
    private _match: Match,
  ) {
  }
  
  public endGame() {
  }
  
  public runGameActionEffects(
    effectName: string,
    playerId?: number,
    cardId?: number,
  ): unknown {
    const generatorFn = this._effectGeneratorMap[effectName];
    
    if (!generatorFn) {
      console.log(`[EFFECT CONTROLLER] '${effectName}' game action effects generator not found`,);
      return;
    }
    console.log(`[EFFECT CONTROLLER] running '${effectName}' game action effect generator`,);
    
    const gen = generatorFn({
      match: this._match,
      cardLibrary: this._cardLibrary,
      triggerPlayerId: playerId!,
      triggerCardId: cardId,
    });
    return this.runGenerator(gen, playerId, cardId);
  }
  
  public runCardEffects(
    playerId: number,
    cardId: number,
    reactionContext?: unknown,
  ): unknown {
    const card = this._cardLibrary.getCard(cardId);
    const generatorFn = this._effectGeneratorMap[card?.cardKey ?? ''];
    
    if (!generatorFn) {
      console.log(`[EFFECT CONTROLLER] No card effects generator found for ${card}`);
      return;
    }
    
    console.log(`[EFFECT CONTROLLER] running card effects generator for ${card}`);
    
    const gen = generatorFn({
      match: this._match,
      cardLibrary: this._cardLibrary,
      triggerCardId: cardId,
      triggerPlayerId: playerId,
      reactionContext,
    });
    
    return this.runGenerator(gen, playerId, cardId);
  }
  
  public runGenerator(
    generator: EffectGenerator<GameEffects>,
    playerId?: number,
    cardId?: number,
    onComplete?: () => void
  ) {
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
      playerId,
      cardId,
      onComplete
    });
  }
  
  public setEffectPipeline(pipeline: EffectsPipeline) {
    this._effectsPipeline = pipeline;
  }
}
