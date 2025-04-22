import { Match } from "shared/shared-types.ts";

export const getCurrentPlayer = (match: Match) => match.players[match.currentPlayerTurnIndex];
