import * as log from '@timepp/enhanced-deno-log';
import { ServerConfigService } from './server-config-service.ts';

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
  private static initialized = false;
  private static readonly defaultBackend: LoggerBackend = {
    log: (...args: unknown[]) => console.log(...args),
    info: (...args: unknown[]) => console.info(...args),
    debug: (...args: unknown[]) => console.debug(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
  };
  private static backend: LoggerBackend = LoggerService.defaultBackend;

  constructor(
    private readonly serverConfigService: ServerConfigService,
    private readonly loggerContext: LoggerContext = {},
  ) {
    LoggerService.initializeBackend(this.serverConfigService);
  }

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

  // Initializes enhanced-deno-log backend once, when LoggerService is first resolved.
  private static initializeBackend(serverConfigService: ServerConfigService): void {
    if (LoggerService.initialized) {
      return;
    }
    LoggerService.initialized = true;

    // Avoid crashing before explicit startup validation; invalid env values are validated later.
    let logToFileEnabled = false;
    try {
      logToFileEnabled = serverConfigService.isFileLoggingEnabled();
    } catch {
      logToFileEnabled = false;
    }

    // Disable file output unless explicitly enabled.
    if (!logToFileEnabled) {
      log.setConfig({
        enabledLevels: [],
      }, 'file');
    }

    // Configure console level colors.
    log.setConfig({
      colors: {
        log: 'white',
        info: 'blue',
        debug: 'cyan',
        warn: 'yellow',
        error: 'red',
        func: '#f5f5f5',
        timer: 'green',
      },
    }, 'console');

    log.init();

    // Some terminals ignore `%c` styles from enhanced-deno-log; apply ANSI wrappers for level distinction.
    const useAnsiMessageColors = !logToFileEnabled;
    const enhancedBackend = log as unknown as Partial<LoggerBackend>;
    LoggerService.backend = {
      log: (...args: unknown[]) => (enhancedBackend.log ?? console.log)(...args),
      info: (...args: unknown[]) =>
        (enhancedBackend.info ?? console.info)(
          ...LoggerService.withAnsiColor(args, 36, useAnsiMessageColors),
        ),
      debug: (...args: unknown[]) =>
        (enhancedBackend.debug ?? console.debug)(
          ...LoggerService.withAnsiColor(args, 90, useAnsiMessageColors),
        ),
      warn: (...args: unknown[]) =>
        (enhancedBackend.warn ?? console.warn)(
          ...LoggerService.withAnsiColor(args, 33, useAnsiMessageColors),
        ),
      error: (...args: unknown[]) =>
        (enhancedBackend.error ?? console.error)(
          ...LoggerService.withAnsiColor(args, 31, useAnsiMessageColors),
        ),
    };
  }

  // Adds ANSI color wrappers for terminals that do not apply CSS-style console coloring.
  private static withAnsiColor(args: unknown[], colorCode: number, enabled: boolean): unknown[] {
    if (!enabled || args.length < 1) {
      return args;
    }

    const start = `\u001b[${colorCode}m`;
    const reset = '\u001b[0m';
    const [first, ...rest] = args;

    if (typeof first === 'string') {
      return [`${start}${first}${reset}`, ...rest];
    }

    return [start, first, ...rest, reset];
  }
}
