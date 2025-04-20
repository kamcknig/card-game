// Holds the final boolean value
import { computed } from 'nanostores';
import { playerDisconnectedStore } from './game-state';

export const gamePausedStore = computed(playerDisconnectedStore, (isDisconnected) => isDisconnected);
(globalThis as any).gamePausedStore = gamePausedStore;
