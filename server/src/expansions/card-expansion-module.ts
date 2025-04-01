import { AsyncEffectGeneratorFn, EffectGeneratorFn, LifecycleCallbackMap } from '../types.ts';
import { Match } from 'shared/shared-types.ts';
import { CardLibrary } from '../match-controller.ts';

export interface CardExpansionModule {
  registerCardLifeCycles?: () => Record<string, LifecycleCallbackMap>;
  registerScoringFunctions?: () => Record<string, (match: Match, cardLibrary: CardLibrary, ownerPlayerId: number) => number>;
  registerEffects: () => Record<string, EffectGeneratorFn | AsyncEffectGeneratorFn>;
}
