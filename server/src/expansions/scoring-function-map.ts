import { Match } from 'shared/shared-types.ts';

import { CardLibrary } from '../core/card-library.ts';
import { CardScoringFnContext } from '../types.ts';

export const scoringFunctionMap: Record<string, (args: CardScoringFnContext) => number> = {}