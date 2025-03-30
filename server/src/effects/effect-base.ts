export type EffectBaseArgs = {
  sourcePlayerId: number;
  sourceCardId?: number;
  triggerImmediateUpdate?: boolean;
};

/**
 * Base class for all effects.
 * Provides a default toJSON() method and a common interface.
 */
export abstract class EffectBase {
  abstract type: string;
  public sourceCardId: number;
  public sourcePlayerId: number;
  public triggerImmediateUpdate?: boolean;

  protected constructor(
    { sourcePlayerId, sourceCardId, triggerImmediateUpdate }: EffectBaseArgs,
  ) {
    this.sourcePlayerId = sourcePlayerId;
    this.sourceCardId = sourceCardId!;
    this.triggerImmediateUpdate = triggerImmediateUpdate!;
  }

  toString() {
    return `[EFFECT '${this.type}', source player ${this.sourcePlayerId}, source card ${this.sourceCardId}']`;
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toString();
  }
}
