import { computed } from 'nanostores';
import { playerTurnOrderStore, turnNumberStore } from './turn-state';

export const roundNumberStore = computed(
  [turnNumberStore, playerTurnOrderStore],
  (turnNumber, turnOrderedPlayers) => {
    return Math.floor(turnNumber / turnOrderedPlayers.length) + 1;
  }
);
