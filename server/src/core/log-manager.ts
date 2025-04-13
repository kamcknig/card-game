import { LogEntry, PlayerId } from 'shared/shared-types.ts';
import { AppSocket, DistributiveOmit } from '../types.ts';

export class LogManager {
  private _depth: number = 0;
  private readonly _socketMap: Map<PlayerId, AppSocket>;
  
  constructor(args: { socketMap: Map<PlayerId, AppSocket> }) {
    this._socketMap = args.socketMap;
  }
  
  public addLogEntry(entry: DistributiveOmit<LogEntry, 'depth'>) {
    this._socketMap.forEach((s) => s.emit('addLogEntry', { ...entry, depth: this._depth } as LogEntry));
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
  
  public rootLog(entry: DistributiveOmit<LogEntry, 'depth'>) {
    this.startChain();
    this.addLogEntry(entry);
    this.enter();
  }
}