import { Match } from 'shared/types/index.ts';

import { MatchCardLibrary } from '../core/match-card-library.ts';
import { CardScoringFnContext } from '@server-types/index.ts';

export const scoringFunctionMap: Record<string, (args: CardScoringFnContext) => number> = {};
