import {
  LoggerBackend,
  LoggerBackendProvider,
  LoggerContext,
  LoggerService,
} from '../core/logger-service.ts';
import { ServerConfigService } from '../core/server-config-service.ts';

export type CapturedLogEntry = {
  level: keyof LoggerBackend;
  args: unknown[];
};

// Builds a LoggerService instance that captures all log output in-memory for assertions.
export const createTestLogger = (context: LoggerContext = { scope: 'test' }) => {
  const entries: CapturedLogEntry[] = [];
  const loggerBackendProvider = new LoggerBackendProvider(new ServerConfigService());

  loggerBackendProvider.configureBackend({
    log: (...args: unknown[]) => entries.push({ level: 'log', args }),
    info: (...args: unknown[]) => entries.push({ level: 'info', args }),
    debug: (...args: unknown[]) => entries.push({ level: 'debug', args }),
    warn: (...args: unknown[]) => entries.push({ level: 'warn', args }),
    error: (...args: unknown[]) => entries.push({ level: 'error', args }),
  });

  return {
    entries,
    loggerService: new LoggerService(loggerBackendProvider, context),
  };
};
