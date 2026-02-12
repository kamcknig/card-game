import { Match } from "shared/shared-types";

export function getPlayerById(match: Match, playerId: number) {
  return match.players.find((player) => player.id === playerId);
}
