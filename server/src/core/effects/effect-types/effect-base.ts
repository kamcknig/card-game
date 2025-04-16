/**
 * Base class for all effects.
 * Provides a default toJSON() method and a common interface.
 */
export abstract class EffectBase {
  abstract type: string;
  
  protected constructor() {
  
  }
}
