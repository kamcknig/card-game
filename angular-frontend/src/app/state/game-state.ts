import { atom } from 'nanostores';
import { PlayerId } from 'shared/shared-types';
import { playerIdStore, playerStore } from './player-state';


export const playerDisconnectedStore = atom<boolean>(false);

// Internal: Track all subscriptions so we can clean them up
let unsubscribers: (() => void)[] = [];

// Track changes to player ID list
playerIdStore.subscribe((ids) => {
  // Clean up previous player subscriptions
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  // Subscribe to each player
  for (const id of ids) {
    const unsub = playerStore(id).subscribe(updatePausedState);
    unsubscribers.push(unsub);
  }

  // Update initial value
  updatePausedState();
});

function updatePausedState() {
  const ids = playerIdStore.get();
  const players = ids.map(id => playerStore(id).get());
  const anyDisconnected = players.some(p => !p?.connected);
  playerDisconnectedStore.set(anyDisconnected);
}

export const gameOwnerIdStore = atom<PlayerId | undefined>();
(globalThis as any).gameOwnerIdStore = gameOwnerIdStore;

export type SceneNames = 'configuration' | 'match' | 'gameSummary';

export const sceneStore = atom<SceneNames>('configuration');
(globalThis as any).sceneStore = sceneStore;
