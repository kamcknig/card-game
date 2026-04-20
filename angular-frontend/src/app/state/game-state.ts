import { atom } from 'nanostores';
import { PlayerId } from 'shared/types';
import { playerIdStore, playerStore } from './player-state';


export const playerDisconnectedStore = atom<boolean>(false);
export const disconnectedHumanIdsStore = atom<PlayerId[]>([]);

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
  const disconnectedHumans = players
    .filter(p => p && !p.connected && !p.isComputer)
    .map(p => p!.id);
  const anyDisconnected = disconnectedHumans.length > 0;
  playerDisconnectedStore.set(anyDisconnected);
  disconnectedHumanIdsStore.set(disconnectedHumans);
}

export const gameOwnerIdStore = atom<PlayerId | undefined>();
(globalThis as any).gameOwnerIdStore = gameOwnerIdStore;

