import type { CardLifecycleCallbackMap, CardScoringFunction } from '@server-types/index.ts';
import type { CardKey } from 'shared/types/index.ts';
import { LoggerService } from './logger-service.ts';

// Stores expansion-registered scoring and lifecycle metadata.
export class ExpansionCardMetadataRegistryService {
  private readonly _scoringFunctions: Partial<Record<CardKey, CardScoringFunction>> = {};
  private readonly _lifecycleMethods: Partial<Record<CardKey, CardLifecycleCallbackMap>> = {};

  constructor(private readonly loggerService: LoggerService) {}

  // Registers a card scoring function by card key.
  public registerScoringFunction(cardKey: CardKey, scoringFunction: CardScoringFunction): void {
    if (this._scoringFunctions[cardKey]) {
      this.loggerService.warn(`[expansion metadata] scoring function for ${cardKey} already registered, overwriting`);
    }
    this._scoringFunctions[cardKey] = scoringFunction;
  }

  // Registers card lifecycle methods by card key.
  public registerLifecycleMethods(cardKey: CardKey, lifecycleMethods: CardLifecycleCallbackMap): void {
    if (this._lifecycleMethods[cardKey]) {
      this.loggerService.warn(`[expansion metadata] lifecycle methods for ${cardKey} already registered, overwriting`);
    }
    this._lifecycleMethods[cardKey] = lifecycleMethods;
  }

  // Returns a registered scoring function for a card key, if present.
  public getScoringFunction(cardKey: CardKey): CardScoringFunction | undefined {
    return this._scoringFunctions[cardKey];
  }

  // Returns registered lifecycle methods for a card key, if present.
  public getLifecycleMethods(cardKey: CardKey): CardLifecycleCallbackMap | undefined {
    return this._lifecycleMethods[cardKey];
  }
}
