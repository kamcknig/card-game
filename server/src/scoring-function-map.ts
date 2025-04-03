import {Match} from 'shared/shared-types.ts';
import { CardLibrary } from './match-controller.ts';

export const scoringFunctionMap: Record<string, (args: { match: Match, cardLibrary: CardLibrary, ownerId: number }) => number> = {

}