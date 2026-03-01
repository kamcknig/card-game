import { assertEquals } from '@std/assert';
import { LoggerBackendProvider, LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';

// Captured log entry shape for assertions.
type CapturedEntry = {
  level: string;
  args: unknown[];
};

// Builds a LoggerBackendProvider with an in-memory backend that captures entries.
const createCaptureProvider = () => {
  const entries: CapturedEntry[] = [];
  const provider = new LoggerBackendProvider(new ServerConfigService());
  provider.configureBackend({
    log: (...args: unknown[]) => entries.push({ level: 'log', args }),
    info: (...args: unknown[]) => entries.push({ level: 'info', args }),
    debug: (...args: unknown[]) => entries.push({ level: 'debug', args }),
    warn: (...args: unknown[]) => entries.push({ level: 'warn', args }),
    error: (...args: unknown[]) => entries.push({ level: 'error', args }),
  });
  return { entries, provider };
};

// --- LoggerService basic level methods ---

Deno.test('LoggerService.log emits at log level', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, {});

  logger.log('hello');

  assertEquals(entries.length, 1);
  assertEquals(entries[0].level, 'log');
});

Deno.test('LoggerService.info emits at info level', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, {});

  logger.info('info message');

  assertEquals(entries.length, 1);
  assertEquals(entries[0].level, 'info');
});

Deno.test('LoggerService.debug emits at debug level', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, {});

  logger.debug('debug message');

  assertEquals(entries.length, 1);
  assertEquals(entries[0].level, 'debug');
});

Deno.test('LoggerService.warn emits at warn level', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, {});

  logger.warn('warning');

  assertEquals(entries.length, 1);
  assertEquals(entries[0].level, 'warn');
});

Deno.test('LoggerService.error emits at error level', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, {});

  logger.error('error message');

  assertEquals(entries.length, 1);
  assertEquals(entries[0].level, 'error');
});

// --- WithContext methods ---

Deno.test('LoggerService.logWithContext merges one-off context', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, { scope: 'base' });

  logger.logWithContext({ extra: 'value' }, 'merged');

  assertEquals(entries.length, 1);
  assertEquals(entries[0].level, 'log');
  // The context prefix should contain both base and extra context.
  const prefix = entries[0].args[0] as string;
  assertEquals(prefix.includes('scope=base'), true);
  assertEquals(prefix.includes('extra=value'), true);
});

Deno.test('LoggerService.infoWithContext merges context at info level', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, { gameId: 'g1' });

  logger.infoWithContext({ matchScopeId: 1 }, 'match started');

  assertEquals(entries.length, 1);
  assertEquals(entries[0].level, 'info');
  const prefix = entries[0].args[0] as string;
  assertEquals(prefix.includes('gameId=g1'), true);
  assertEquals(prefix.includes('matchScopeId=1'), true);
});

Deno.test('LoggerService.debugWithContext merges context at debug level', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, {});

  logger.debugWithContext({ key: 'val' }, 'detail');

  assertEquals(entries.length, 1);
  assertEquals(entries[0].level, 'debug');
});

Deno.test('LoggerService.warnWithContext merges context at warn level', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, {});

  logger.warnWithContext({ key: 'val' }, 'caution');

  assertEquals(entries.length, 1);
  assertEquals(entries[0].level, 'warn');
});

Deno.test('LoggerService.errorWithContext merges context at error level', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, {});

  logger.errorWithContext({ key: 'val' }, 'failure');

  assertEquals(entries.length, 1);
  assertEquals(entries[0].level, 'error');
});

// --- Context prefix formatting ---

Deno.test('LoggerService emits no context prefix when context is empty', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, {});

  logger.info('bare message');

  assertEquals(entries.length, 1);
  // With empty context, only the message should appear (no prefix).
  assertEquals(entries[0].args.length, 1);
  assertEquals(entries[0].args[0], 'bare message');
});

Deno.test('LoggerService emits context prefix when context has values', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, { scope: 'test' });

  logger.info('with context');

  assertEquals(entries.length, 1);
  // Should have prefix + message as separate args.
  assertEquals(entries[0].args.length, 2);
  assertEquals(entries[0].args[0], '[ctx scope=test]');
  assertEquals(entries[0].args[1], 'with context');
});

Deno.test('LoggerService omits undefined context values from prefix', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, { scope: 'test', gameId: undefined });

  logger.info('filtered');

  assertEquals(entries.length, 1);
  const prefix = entries[0].args[0] as string;
  assertEquals(prefix.includes('gameId'), false);
  assertEquals(prefix.includes('scope=test'), true);
});

// --- LoggerBackendProvider ---

Deno.test('LoggerBackendProvider.configureBackend partially overrides methods', () => {
  const provider = new LoggerBackendProvider(new ServerConfigService());
  const captured: string[] = [];

  provider.configureBackend({
    warn: (..._args: unknown[]) => captured.push('custom-warn'),
  });

  const backend = provider.getBackend();
  backend.warn('test');

  assertEquals(captured, ['custom-warn']);
});

Deno.test('LoggerBackendProvider.getBackend returns a backend with all five methods', () => {
  const provider = new LoggerBackendProvider(new ServerConfigService());
  const backend = provider.getBackend();

  assertEquals(typeof backend.log, 'function');
  assertEquals(typeof backend.info, 'function');
  assertEquals(typeof backend.debug, 'function');
  assertEquals(typeof backend.warn, 'function');
  assertEquals(typeof backend.error, 'function');
});

Deno.test('LoggerService passes multiple arguments through to backend', () => {
  const { entries, provider } = createCaptureProvider();
  const logger = new LoggerService(provider, {});

  logger.info('count', 42, { extra: true });

  assertEquals(entries.length, 1);
  assertEquals(entries[0].args, ['count', 42, { extra: true }]);
});
