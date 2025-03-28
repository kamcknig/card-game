import { Match } from 'shared/shared-types.ts';

export const getCurrentPlayerId = (match: Match) => {
  return match.players[match.currentPlayerTurnIndex];
}
