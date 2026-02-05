import { CardKey, Match, PlayerId, State } from 'shared/shared-types';

// Returns the state ids owned by a player.
export const getPlayerStateIds = (match: Match, playerId: PlayerId): number[] => {
  return match.states?.byPlayer?.[playerId] ?? [];
};

// Returns full state objects owned by a player.
export const getPlayerStates = (match: Match, playerId: PlayerId): State[] => {
  const ownedIds = new Set(getPlayerStateIds(match, playerId));
  return (match.states?.cards ?? []).filter(state => ownedIds.has(state.id));
};

// Checks whether a player owns a specific state by card key.
export const playerHasState = (match: Match, playerId: PlayerId, stateKey: CardKey): boolean => {
  return getPlayerStates(match, playerId).some(state => state.cardKey === stateKey);
};

// Finds a specific state instance for a player by card key.
export const getPlayerStateByKey = (match: Match, playerId: PlayerId, stateKey: CardKey): State | undefined => {
  return getPlayerStates(match, playerId).find(state => state.cardKey === stateKey);
};
