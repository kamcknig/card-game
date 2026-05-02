/** Thrown into in-flight prompt awaits when an undo aborts the action. */
export class UndoAbortError extends Error {
  constructor() {
    super('undo: action aborted');
    this.name = 'UndoAbortError';
  }
}

/**
 * Per-match registry that lets the undo service reject every in-flight
 * userPrompt / selectCard / selectSingleCard Promise. Each prompt
 * registers its rejecter on entry and removes it on resolve; abortAll
 * rejects every still-pending promise with UndoAbortError.
 */
export class PromptAbortRegistry {
  private readonly _pending = new Map<string, (error: unknown) => void>();

  /**
   * Registers a rejecter for `signalId`. Returns an unregister function
   * that removes the entry from the registry without rejecting it.
   */
  public register(signalId: string, reject: (error: unknown) => void): () => void {
    this._pending.set(signalId, reject);
    return () => {
      this._pending.delete(signalId);
    };
  }

  /**
   * Rejects every currently-registered prompt with UndoAbortError. The
   * map is cleared as a side effect so callers can't double-reject.
   */
  public abortAll(): void {
    const rejecters = Array.from(this._pending.values());
    this._pending.clear();
    const error = new UndoAbortError();
    for (const reject of rejecters) {
      reject(error);
    }
  }

  /** True when at least one prompt is currently in flight. */
  public hasInFlight(): boolean {
    return this._pending.size > 0;
  }
}
