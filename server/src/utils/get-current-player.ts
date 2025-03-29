import { Match } from 'shared/shared-types.ts';

export const getCurrentPlayer = (match: Match) => {
  return match.players[match.currentPlayerTurnIndex];
}
