import { LoggerService } from '../core/logger-service.ts';

// Shared logger instance for non-DI modules.
export const loggerService = new LoggerService();
