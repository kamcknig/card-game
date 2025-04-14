export type EffectBaseArgs = {
  sourcePlayerId: number;
  sourceCardId?: number;
  isRootLog?: boolean;
  logEffect?: boolean;
};

/**
 * Base class for all effects.
 * Provides a default toJSON() method and a common interface.
 */
export abstract class EffectBase {
  abstract type: string;
  public sourceCardId: number;
  public sourcePlayerId: number;
  public isRootLog?: boolean;
  public logEffect?: boolean;
  
  protected constructor(
    { isRootLog, sourcePlayerId, sourceCardId, logEffect }: EffectBaseArgs,
  ) {
    this.sourcePlayerId = sourcePlayerId;
    this.sourceCardId = sourceCardId!;
    this.isRootLog = isRootLog ?? false;
    this.logEffect = logEffect ?? true;
  }
  
  toString() {
    return `[EFFECT '${this.type}', source player ${this.sourcePlayerId}, source card ${this.sourceCardId}']`;
  }
  
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString();
  }
}
