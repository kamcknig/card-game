import { atom } from 'nanostores';
import { UndoCompletedPayload } from 'shared/types';

/** True while the local user has an undo request awaiting resolution. */
export const undoInFlightStore = atom(false);

/**
 * Last undoCompleted payload received from the server. Cleared (set to null)
 * immediately after subscribers consume it via a queueMicrotask in the
 * socket-event-map handler. Acts as a one-shot signal channel so components
 * can react to each resolved undo outcome exactly once.
 */
export const undoCompletedSignalStore = atom<UndoCompletedPayload | null>(null);

(globalThis as any).undoInFlightStore = undoInFlightStore;
(globalThis as any).undoCompletedSignalStore = undoCompletedSignalStore;
