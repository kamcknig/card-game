// Logging backend contract used by the logger adapter.
export type LoggerBackend = {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

// Small injectable logger wrapper for consistent logging and easier test substitution.
export class LoggerService {
  private _backend: LoggerBackend = {
    log: (...args: unknown[]) => console.log(...args),
    info: (...args: unknown[]) => console.info(...args),
    debug: (...args: unknown[]) => console.debug(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
  };

  // Replaces backend handlers while preserving unspecified methods.
  public configureBackend(backend: Partial<LoggerBackend>): void {
    this._backend = {
      ...this._backend,
      ...backend ?? {},
    };
  }

  public log(...args: unknown[]): void {
    this._backend.log(...args);
  }

  public info(...args: unknown[]): void {
    this._backend.info(...args);
  }

  public debug(...args: unknown[]): void {
    this._backend.debug(...args);
  }

  public warn(...args: unknown[]): void {
    this._backend.warn(...args);
  }

  public error(...args: unknown[]): void {
    this._backend.error(...args);
  }
}
