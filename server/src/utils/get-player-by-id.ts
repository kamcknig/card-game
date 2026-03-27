import { Match } from 'shared/types/index.ts';

export function getPlayerById(match: Match, playerId: number) {
  return match.players.find(player => player.id === playerId);
}
