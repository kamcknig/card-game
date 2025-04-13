import { LogEntry } from "shared/shared-types.ts";

export class LogManager {
  private _depth: number = 0;
  
  public addLogEntry(entry: LogEntry) {
  
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