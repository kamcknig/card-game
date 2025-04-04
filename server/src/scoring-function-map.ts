import {Match} from 'shared/shared-types.ts';

import { CardLibrary } from './card-library.ts';

export const scoringFunctionMap: Record<string, (args: { match: Match, cardLibrary: CardLibrary, ownerId: number }) => number> = {

}