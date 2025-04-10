export type EffectBaseArgs = {
  sourcePlayerId: number;
  sourceCardId?: number;
};

/**
 * Base class for all effects.
 * Provides a default toJSON() method and a common interface.
 */
export abstract class EffectBase {
  abstract type: string;
  public sourceCardId: number;
  public sourcePlayerId: number;
  
  protected constructor(
    { sourcePlayerId, sourceCardId }: EffectBaseArgs,
  ) {
    this.sourcePlayerId = sourcePlayerId;
    this.sourceCardId = sourceCardId!;
  }
  
  toString() {
    return `[EFFECT '${this.type}', source player ${this.sourcePlayerId}, source card ${this.sourceCardId}']`;
  }
  
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString();
  }
}
