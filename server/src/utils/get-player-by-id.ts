import { Match } from 'shared/shared-types.ts';

export function getPlayerById(match: Match, playerId: number) {
  return match.players.find((player) => player.id === playerId);
}
