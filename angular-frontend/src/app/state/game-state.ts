import { atom } from 'nanostores';
import { Player, PlayerId } from 'shared/types';
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

// Represents one player's ready state for use in the post-game ready-up UI.
export interface PlayerReadyEntry {
  playerId: PlayerId;
  name: string;
  ready: boolean;
  isComputer: boolean;
}

// Reactive list of all current players with their ready state for the post-game ready UI.
export const connectedPlayerReadyListStore = atom<PlayerReadyEntry[]>([]);

// True when every connected non-computer player has marked ready.
export const allConnectedPlayersReadyStore = atom<boolean>(false);

// Tracks subscriptions to individual player stores so they can be cleaned up on list changes.
let _readyTrackingUnsubscribers: (() => void)[] = [];

// Re-subscribes to all player atoms whenever the player ID list changes, ensuring
// connectedPlayerReadyListStore and allConnectedPlayersReadyStore stay in sync.
playerIdStore.subscribe((ids) => {
  _readyTrackingUnsubscribers.forEach(unsub => unsub());
  _readyTrackingUnsubscribers = [];

  for (const id of ids) {
    const unsub = playerStore(id).subscribe(_updateReadyTracking);
    _readyTrackingUnsubscribers.push(unsub);
  }
  _updateReadyTracking();
});

// Recomputes the ready list and all-ready flag from the current player atoms.
function _updateReadyTracking(): void {
  const ids = playerIdStore.get();
  const players = ids.map(id => playerStore(id).get()).filter((p): p is Player => p !== undefined);

  connectedPlayerReadyListStore.set(
    players.map(p => ({
      playerId: p.id,
      name: p.name,
      ready: p.ready,
      isComputer: p.isComputer ?? false,
    })),
  );

  const humanPlayers = players.filter(p => !p.isComputer);
  allConnectedPlayersReadyStore.set(
    humanPlayers.length > 0 && humanPlayers.every(p => p.ready),
  );
}

(globalThis as any).connectedPlayerReadyListStore = connectedPlayerReadyListStore;
(globalThis as any).allConnectedPlayersReadyStore = allConnectedPlayersReadyStore;

