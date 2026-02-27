import { atom } from 'nanostores';
import { PlayerId } from 'shared/types';

// Active "waiting for player" overlay target shown in the Angular HUD.
export const waitingOnPlayerIdStore = atom<PlayerId | null>(null);

(globalThis as any).waitingOnPlayerIdStore = waitingOnPlayerIdStore;
