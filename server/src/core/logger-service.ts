// Small injectable logger wrapper for consistent logging and easier test substitution.
export class LoggerService {
  public log(...args: unknown[]): void {
    console.log(...args);
  }

  public info(...args: unknown[]): void {
    console.info(...args);
  }

  public debug(...args: unknown[]): void {
    console.debug(...args);
  }

  public warn(...args: unknown[]): void {
    console.warn(...args);
  }

  public error(...args: unknown[]): void {
    console.error(...args);
  }
}
