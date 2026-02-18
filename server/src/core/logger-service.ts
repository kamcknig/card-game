import * as log from '@timepp/enhanced-deno-log';
import { ServerConfigService } from './server-config-service.ts';
import { getGameLogDirectory, getMatchLogDirectory, getServerLogDirectory } from './game-data-paths.ts';

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

type LogLevel = keyof LoggerBackend;

/**
 * Lazily initializes and stores the process-wide logging backend.
 *
 * Lifetime:
 * - Root singleton
 *
 * Consumers:
 * - `LoggerService` instances delegate emission to this provider.
 */
export class LoggerBackendProvider {
  private initialized = false;
  private fileLoggingEnabled = false;
  private logFileMaxBytes = 5 * 1024 * 1024;
  private readonly textEncoder = new TextEncoder();
  private readonly defaultBackend: LoggerBackend = {
    log: (...args: unknown[]) => console.log(...args),
    info: (...args: unknown[]) => console.info(...args),
    debug: (...args: unknown[]) => console.debug(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
  };
  private backend: LoggerBackend = this.defaultBackend;

  constructor(
    private readonly serverConfigService: ServerConfigService,
  ) {
  }

  // Returns the active backend, initializing it once when first requested.
  public getBackend(): LoggerBackend {
    this.initializeBackend();
    return this.backend;
  }

  // Replaces backend handlers while preserving unspecified methods.
  public configureBackend(backend: Partial<LoggerBackend>): void {
    this.backend = {
      ...this.getBackend(),
      ...backend ?? {},
    };
  }

  // Initializes enhanced-deno-log backend once, when first requested.
  private initializeBackend(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    // Avoid crashing before explicit startup validation; invalid env values are validated later.
    try {
      this.fileLoggingEnabled = this.serverConfigService.isFileLoggingEnabled();
    } catch {
      this.fileLoggingEnabled = false;
    }

    try {
      this.logFileMaxBytes = this.serverConfigService.getLogFileMaxBytes();
    } catch {
      this.logFileMaxBytes = 5 * 1024 * 1024;
    }

    // Always disable enhanced-deno-log file sink; we route files ourselves per game directory.
    log.setConfig({
      enabledLevels: [],
    }, 'file');

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
    // Keep readable level colors in console regardless of file logging mode.
    const useAnsiMessageColors = true;
    const enhancedBackend = log as unknown as Partial<LoggerBackend>;
    this.backend = {
      log: (...args: unknown[]) => (enhancedBackend.log ?? console.log)(...args),
      info: (...args: unknown[]) =>
        (enhancedBackend.info ?? console.info)(
          ...this.withAnsiColor(args, 36, useAnsiMessageColors),
        ),
      debug: (...args: unknown[]) =>
        (enhancedBackend.debug ?? console.debug)(
          ...this.withAnsiColor(args, 90, useAnsiMessageColors),
        ),
      warn: (...args: unknown[]) =>
        (enhancedBackend.warn ?? console.warn)(
          ...this.withAnsiColor(args, 33, useAnsiMessageColors),
        ),
      error: (...args: unknown[]) =>
        (enhancedBackend.error ?? console.error)(
          ...this.withAnsiColor(args, 31, useAnsiMessageColors),
        ),
    };
  }

  // Writes one formatted log line to the appropriate file bucket when file logging is enabled.
  public writeToFile(level: LogLevel, context: LoggerContext, args: unknown[]): void {
    this.initializeBackend();
    if (!this.fileLoggingEnabled) {
      return;
    }

    try {
      const now = new Date();
      const dateKey = this.formatDateKey(now);
      const baseFileName = `${dateKey}.log`;
      const bucketDirectory = this.resolveBucketDirectory(context);
      const activeFilePath = `${bucketDirectory}/${baseFileName}`;

      Deno.mkdirSync(bucketDirectory, { recursive: true });

      const logLine = this.formatFileLine(now, level, args);
      const pendingByteLength = this.textEncoder.encode(logLine).byteLength;
      this.rotateIfFileTooLarge(activeFilePath, dateKey, pendingByteLength);

      Deno.writeTextFileSync(activeFilePath, logLine, {
        append: true,
        create: true,
      });
    } catch (error) {
      console.error('[logger] failed to write log file entry', error);
    }
  }

  // Creates a stable YYYYMMDD date key used for active daily log files.
  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  // Creates one compact timestamped log line for file output.
  private formatFileLine(date: Date, level: LogLevel, args: unknown[]): string {
    const timestamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-') + ` ` + [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0'),
    ].join(':') + `.` + String(date.getMilliseconds()).padStart(3, '0');
    const levelLabel = level.toUpperCase().padEnd(5, ' ');
    const message = args.map((arg) => this.toLogString(arg)).join(' ');
    return `[${timestamp}] [${levelLabel}] ${message}\n`;
  }

  // Converts arbitrary payloads to deterministic log strings.
  private toLogString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (value instanceof Error) {
      return value.stack ?? `${value.name}: ${value.message}`;
    }
    return Deno.inspect(value, {
      depth: 5,
      colors: false,
      compact: true,
      sorted: true,
    });
  }

  // Resolves the target directory for one log line based on logger context.
  private resolveBucketDirectory(context: LoggerContext): string {
    const rawGameId = context.gameId;
    if (typeof rawGameId === 'string' && rawGameId.trim().length > 0) {
      const rawMatchScopeId = context.matchScopeId;
      if (typeof rawMatchScopeId === 'number' && Number.isFinite(rawMatchScopeId)) {
        return getMatchLogDirectory(rawGameId, rawMatchScopeId);
      }
      return getGameLogDirectory(rawGameId);
    }
    return getServerLogDirectory();
  }

  // Rotates the active daily file when appending the next line would exceed the configured size.
  private rotateIfFileTooLarge(activeFilePath: string, dateKey: string, pendingByteLength: number): void {
    const activeStat = this.safeStat(activeFilePath);
    if (!activeStat) {
      return;
    }

    // Keep writing to the active file when still within configured size.
    if (activeStat.size + pendingByteLength <= this.logFileMaxBytes) {
      return;
    }

    // Find the next available suffix for this day: _01, _02, _03, ...
    let suffix = 1;
    const activeName = `${dateKey}.log`;
    const directoryPrefix = activeFilePath.endsWith(activeName)
      ? activeFilePath.slice(0, -activeName.length)
      : `${activeFilePath}.`;
    while (true) {
      const suffixLabel = String(suffix).padStart(2, '0');
      const rotatedPath = `${directoryPrefix}${dateKey}_${suffixLabel}.log`;
      if (!this.safeStat(rotatedPath)) {
        Deno.renameSync(activeFilePath, rotatedPath);
        return;
      }
      suffix++;
    }
  }

  // Returns stat data when the path exists, otherwise undefined.
  private safeStat(path: string): Deno.FileInfo | undefined {
    try {
      return Deno.statSync(path);
    } catch {
      return undefined;
    }
  }

  // Adds ANSI color wrappers for terminals that do not apply CSS-style console coloring.
  private withAnsiColor(args: unknown[], colorCode: number, enabled: boolean): unknown[] {
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

// Small injectable logger wrapper for consistent logging and easier test substitution.
export class LoggerService {
  constructor(
    private readonly loggerBackendProvider: LoggerBackendProvider,
    private readonly loggerContext: LoggerContext,
  ) {
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
    const backend = this.loggerBackendProvider.getBackend();
    const contextPrefix = this.buildContextPrefix(context);
    const logArgs = contextPrefix ? [contextPrefix, ...args] : args;
    this.loggerBackendProvider.writeToFile(level, context, logArgs);
    if (contextPrefix) {
      backend[level](contextPrefix, ...args);
      return;
    }
    backend[level](...args);
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
