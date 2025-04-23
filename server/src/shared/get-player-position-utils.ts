import { Match, PlayerId } from 'shared/shared-types.ts';

type GetPlayerIndexArgs = {
  match: Match;
  playerId: PlayerId;
};

export const getPlayerTurnIndex = ({ match, playerId }: GetPlayerIndexArgs) => {
  return match.players.findIndex(p => p.id === playerId);
}

type GetPlayerArgs = {
  startFromIdx: number,
  match: Match,
  distance: number
};

export const getPlayerStartingFrom = ({ startFromIdx, match, distance }: GetPlayerArgs) => {
  const numPlayers = match.players.length;
  const targetIndex = (startFromIdx + distance + numPlayers) % numPlayers;
  return match.players[targetIndex];
};

type DistanceArgs = {
  match: Match;
  startPlayerId: PlayerId;
  targetPlayerId: PlayerId;
  /**
   * @default 'forward'
   */
  direction?: 'forward' | 'backward';
  repetition?: number;
};

/**
 * Returns the distance (number of steps forward) from startPlayerId to targetPlayerId
 * in circular player order.
 */
export const getDistanceToPlayer = ({
  match,
  startPlayerId,
  targetPlayerId,
  repetition = 0,
  direction = 'forward'
}: DistanceArgs): number => {
  const players = match.players;
  const numPlayers = players.length;
  
  const startIdx = players.findIndex(p => p.id === startPlayerId);
  const targetIdx = players.findIndex(p => p.id === targetPlayerId);
  
  if (startIdx === -1 || targetIdx === -1) {
    throw new Error('Player ID not found in match');
  }
  
  let distance = 0;
  
  if (direction === 'forward') {
    distance = (targetIdx - startIdx + numPlayers) % numPlayers + repetition * numPlayers;
  }
  else {
    distance = -((startIdx - targetIdx + numPlayers) % numPlayers + repetition * numPlayers);
  }
  
  return distance;
};