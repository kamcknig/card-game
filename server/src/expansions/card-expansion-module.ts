import { EffectGeneratorFn, LifecycleCallbackMap } from '../types.ts';
import { Match } from 'shared/shared-types.ts';

import { CardLibrary } from '../card-library.ts';

export interface CardExpansionModule {
  registerCardLifeCycles?: () => Record<string, LifecycleCallbackMap>;
  registerScoringFunctions?: () => Record<string, (args: { match: Match, cardLibrary: CardLibrary, ownerId: number }) => number>;
  registerEffects: () => Record<string, EffectGeneratorFn>;
}
