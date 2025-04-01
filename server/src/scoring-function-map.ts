import {Match} from 'shared/shared-types.ts';
import { CardLibrary } from './match-controller.ts';

export const scoringFunctionMap: Record<string, (match: Match, cardLibrary: CardLibrary, cardOwnerId: number) => number> = {

}