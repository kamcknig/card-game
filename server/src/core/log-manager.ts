import { LogEntry, PlayerId } from 'shared/types/index.ts';
import { AppSocket, DistributiveOmit } from '@server-types/index.ts';

export class LogManager {
  private _depth: number = 0;
  private _history: LogEntry[] = [];
  // Cap history to prevent unbounded growth.
  private readonly _historyLimit = 5000;
  constructor(private readonly socketMap: Map<PlayerId, AppSocket>) {}

  public addLogEntry(entry: DistributiveOmit<LogEntry, 'depth'> & { root?: boolean }) {
    if (entry.root) {
      this.rootLog(entry);
    } else {
      this.sendLogs(entry);
    }
  }

  private rootLog(entry: LogEntry) {
    this.startChain();
    this.sendLogs(entry);
    this.enter();
  }

  private _queue: LogEntry[] = [];

  private sendLogs(entry: LogEntry) {
    this._queue.push({ ...entry, depth: this._depth });
  }

  public flushQueue() {
    if (!this._queue.length) return;
    const entries = [...this._queue];
    this._history.push(...entries);
    if (this._history.length > this._historyLimit) {
      this._history = this._history.slice(-this._historyLimit);
    }
    this.socketMap.forEach((s) => s.emit('addLogEntry', entries));
    this._queue = [];
  }

  // Returns a cloned copy of the log history for reconnecting clients.
  public getHistory(): LogEntry[] {
    return [...this._history];
  }

  public startChain() {
    this._depth = 0;
  }

  public enter() {
    this._depth++;
  }

  public exit() {
    this._depth = Math.max(0, this._depth - 1);
  }

  public async withIndent<T>(fn: () => Promise<T> | T): Promise<T> {
    // Keep indentation balanced even if a reaction throws.
    this.enter();
    try {
      return await fn();
    } finally {
      this.exit();
    }
  }
}
