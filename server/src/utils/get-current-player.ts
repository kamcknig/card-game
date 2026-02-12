import { Match } from "shared/shared-types";

export const getCurrentPlayer = (match: Match) => match.players[match.currentPlayerTurnIndex];
