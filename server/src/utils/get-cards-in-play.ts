import { Match } from "shared/shared-types.ts";

export const getCardsInPlay = (match: Match) => match.playArea.concat(match.activeDurationCards);
