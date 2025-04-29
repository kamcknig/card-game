import { LogEntry, PlayerId } from 'shared/shared-types.ts';
import { AppSocket, DistributiveOmit } from '../types.ts';

export class LogManager {
  private _depth: number = 0;
  private readonly _socketMap: Map<PlayerId, AppSocket>;
  
  constructor(args: { socketMap: Map<PlayerId, AppSocket> }) {
    this._socketMap = args.socketMap;
  }
  
  public addLogEntry(entry: DistributiveOmit<LogEntry, 'depth'> & { root?: boolean; }) {
    if (entry.root) {
      this.rootLog(entry);
    }
    else {
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
    this._socketMap.forEach((s) => s.emit('addLogEntry', [...this._queue]));
    this._queue = [];
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
}