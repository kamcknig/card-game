import { Match } from 'shared/types/index.ts';

export const getCurrentPlayer = (match: Match) => match.players[match.currentPlayerTurnIndex];
