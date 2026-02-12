import { Match } from 'shared/shared-types';

import { MatchCardLibrary } from '../core/match-card-library.ts';
import { CardScoringFnContext } from '../types.ts';

export const scoringFunctionMap: Record<string, (args: CardScoringFnContext) => number> = {};
