import { atom } from 'nanostores';
import { PlayerId, UndoCompletedPayload } from 'shared/types';

/** True while the local user has an undo request awaiting resolution. */
export const undoInFlightStore = atom(false);

/**
 * Last undoCompleted payload received from the server. Cleared (set to null)
 * immediately after subscribers consume it via a queueMicrotask in the
 * socket-event-map handler. Acts as a one-shot signal channel so components
 * can react to each resolved undo outcome exactly once.
 */
export const undoCompletedSignalStore = atom<UndoCompletedPayload | null>(null);

/**
 * Server-pushed originator id for an in-flight undo vote that this client
 * must respond to. Null when no vote is currently open for this client.
 * Set by the undoVoteRequested socket handler; cleared by
 * UndoVoteCoordinatorService when the vote resolves or the user responds.
 */
export const undoVoteRequestStore = atom<PlayerId | null>(null);

/**
 * True when the server has at least one snapshot available to restore.
 * Updated after every top-level action and after every undo restore via
 * the undoAvailable socket event. Drives the disabled state of the undo
 * button in the game-log header.
 */
export const undoAvailableStore = atom(false);

(globalThis as any).undoInFlightStore = undoInFlightStore;
(globalThis as any).undoCompletedSignalStore = undoCompletedSignalStore;
(globalThis as any).undoVoteRequestStore = undoVoteRequestStore;
(globalThis as any).undoAvailableStore = undoAvailableStore;
