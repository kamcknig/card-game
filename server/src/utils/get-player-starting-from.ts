import { Match } from 'shared/shared-types.ts';

type Args = {
  startFromIdx: number,
  match: Match,
  distance: number
};

export const getPlayerStartingFrom = ({ startFromIdx, match, distance }: Args) => {
  const numPlayers = match.players.length;
  const targetIndex = (startFromIdx + distance + numPlayers) % numPlayers;
  return match.players[targetIndex];
};
