import * as log from '@timepp/enhanced-deno-log';
import { LoggerBackend, LoggerService } from './logger-service.ts';
import { ServerConfigService } from './server-config-service.ts';

// Initializes logger backend wiring and validates server logging-related config.
export class LoggingBootstrapService {
  private initialized = false;

  constructor(
    private readonly serverConfigService: ServerConfigService,
    private readonly loggerService: LoggerService,
  ) {}

  // Validates config and routes LoggerService output to enhanced-deno-log.
  public initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    // Fail fast when startup env values are malformed.
    this.serverConfigService.validate();

    // Default to disabling file logs unless explicitly enabled.
    const logToFileEnabled = this.serverConfigService.isFileLoggingEnabled();
    if (!logToFileEnabled) {
      log.setConfig({
        enabledLevels: [],
      }, 'file');
    }

    // Configure console colors to match desired log level styling.
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

    // Route logger service output through enhanced-deno-log when available.
    const enhancedBackend = log as unknown as Partial<LoggerBackend>;
    this.loggerService.configureBackend({
      log: (...args: unknown[]) => (enhancedBackend.log ?? console.log)(...args),
      info: (...args: unknown[]) => (enhancedBackend.info ?? console.info)(...args),
      debug: (...args: unknown[]) => (enhancedBackend.debug ?? console.debug)(...args),
      warn: (...args: unknown[]) => (enhancedBackend.warn ?? console.warn)(...args),
      error: (...args: unknown[]) => (enhancedBackend.error ?? console.error)(...args),
    });
  }
}
