// Logging backend contract used by the logger adapter.
export type LoggerBackend = {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

// Structured context values used to annotate log lines.
export type LoggerContextValue = string | number | boolean | null | undefined;
export type LoggerContext = Record<string, LoggerContextValue>;

// Small injectable logger wrapper for consistent logging and easier test substitution.
export class LoggerService {
  private static readonly defaultBackend: LoggerBackend = {
    log: (...args: unknown[]) => console.log(...args),
    info: (...args: unknown[]) => console.info(...args),
    debug: (...args: unknown[]) => console.debug(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
  };
  private static backend: LoggerBackend = LoggerService.defaultBackend;

  constructor(
    private readonly loggerContext: LoggerContext = {},
  ) {}

  // Replaces backend handlers while preserving unspecified methods.
  public configureBackend(backend: Partial<LoggerBackend>): void {
    LoggerService.backend = {
      ...LoggerService.backend,
      ...backend ?? {},
    };
  }

  public log(...args: unknown[]): void {
    this.emit('log', this.loggerContext, ...args);
  }

  public info(...args: unknown[]): void {
    this.emit('info', this.loggerContext, ...args);
  }

  public debug(...args: unknown[]): void {
    this.emit('debug', this.loggerContext, ...args);
  }

  public warn(...args: unknown[]): void {
    this.emit('warn', this.loggerContext, ...args);
  }

  public error(...args: unknown[]): void {
    this.emit('error', this.loggerContext, ...args);
  }

  // Logs at 'log' level with merged one-off context values.
  public logWithContext(context: LoggerContext, ...args: unknown[]): void {
    this.emit('log', this.mergeContext(context), ...args);
  }

  // Logs at 'info' level with merged one-off context values.
  public infoWithContext(context: LoggerContext, ...args: unknown[]): void {
    this.emit('info', this.mergeContext(context), ...args);
  }

  // Logs at 'debug' level with merged one-off context values.
  public debugWithContext(context: LoggerContext, ...args: unknown[]): void {
    this.emit('debug', this.mergeContext(context), ...args);
  }

  // Logs at 'warn' level with merged one-off context values.
  public warnWithContext(context: LoggerContext, ...args: unknown[]): void {
    this.emit('warn', this.mergeContext(context), ...args);
  }

  // Logs at 'error' level with merged one-off context values.
  public errorWithContext(context: LoggerContext, ...args: unknown[]): void {
    this.emit('error', this.mergeContext(context), ...args);
  }

  // Emits a log line using the current backend, with context prefix when present.
  private emit(level: keyof LoggerBackend, context: LoggerContext, ...args: unknown[]): void {
    const contextPrefix = this.buildContextPrefix(context);
    if (contextPrefix) {
      LoggerService.backend[level](contextPrefix, ...args);
      return;
    }
    LoggerService.backend[level](...args);
  }

  // Serializes logger context as a compact stable prefix.
  private buildContextPrefix(context: LoggerContext): string {
    const entries = Object.entries(context).filter(([, value]) => value !== undefined);
    if (!entries.length) {
      return '';
    }
    const pairs = entries
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ');
    return `[ctx ${pairs}]`;
  }

  // Merges scoped context with one-off context for a single log call.
  private mergeContext(context: LoggerContext): LoggerContext {
    return {
      ...this.loggerContext,
      ...context,
    };
  }
}
