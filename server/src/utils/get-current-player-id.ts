import { Match } from 'shared/types.ts';

export const getCurrentPlayerId = (match: Match) => {
  return match.players[match.currentPlayerTurnIndex % match.players.length];
}
