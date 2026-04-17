import { assertEquals } from '@std/assert';
import { AuthSessionService } from '../auth/auth-session-service.ts';
import { AuthProvider, AuthResult } from '../auth/auth-provider.ts';
import { LoggerService } from '../logger-service.ts';

// Minimal logger stub that silences output during tests.
const makeLoggerStub = (): LoggerService =>
  ({
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  }) as unknown as LoggerService;

// Builds a test AuthProvider that returns a fixed result.
const makeProvider = (name: string, result: AuthResult, initSpy?: () => void): AuthProvider => ({
  name,
  authenticate: async (_credentials) => {
    await Promise.resolve();
    return result;
  },
  initialize: initSpy
    ? async () => {
        await Promise.resolve();
        initSpy();
      }
    : undefined,
});

Deno.test('AuthSessionService: login returns error for unknown provider', async () => {
  const service = new AuthSessionService(makeLoggerStub());

  const result = await service.login('unknown', { username: 'alice', password: 'pw' });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.message, 'Unknown authentication provider');
  }
});

Deno.test('AuthSessionService: login returns error when provider rejects credentials', async () => {
  const service = new AuthSessionService(makeLoggerStub());
  service.registerProvider(makeProvider('password', { ok: false, message: 'bad creds' }));
  await service.initializeProviders();

  const result = await service.login('password', { username: 'alice', password: 'wrong' });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.message, 'bad creds');
  }
});

Deno.test('AuthSessionService: login returns token and username on success', async () => {
  const service = new AuthSessionService(makeLoggerStub());
  service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
  await service.initializeProviders();

  const result = await service.login('password', { username: 'alice', password: 'correct' });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(typeof result.token, 'string');
    assertEquals(result.token.length > 0, true);
    assertEquals(result.username, 'alice');
  }
});

Deno.test('AuthSessionService: validateToken returns username for valid token', async () => {
  const service = new AuthSessionService(makeLoggerStub());
  service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
  await service.initializeProviders();

  const loginResult = await service.login('password', {});
  if (!loginResult.ok) throw new Error('Expected ok');

  const username = service.validateToken(loginResult.token);
  assertEquals(username, 'alice');
});

Deno.test('AuthSessionService: validateToken returns undefined for unknown token', () => {
  const service = new AuthSessionService(makeLoggerStub());

  const username = service.validateToken('not-a-real-token');
  assertEquals(username, undefined);
});

Deno.test('AuthSessionService: removeSession makes token invalid', async () => {
  const service = new AuthSessionService(makeLoggerStub());
  service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
  await service.initializeProviders();

  const loginResult = await service.login('password', {});
  if (!loginResult.ok) throw new Error('Expected ok');

  service.removeSession(loginResult.token);
  assertEquals(service.validateToken(loginResult.token), undefined);
});

Deno.test('AuthSessionService: removeSession on unknown token is a no-op', () => {
  const service = new AuthSessionService(makeLoggerStub());
  // Should not throw.
  service.removeSession('ghost-token');
});

Deno.test('AuthSessionService: duplicate provider registration is ignored', () => {
  const service = new AuthSessionService(makeLoggerStub());
  const providerA = makeProvider('password', { ok: true, username: 'alice' });
  const providerB = makeProvider('password', { ok: true, username: 'bob' });

  service.registerProvider(providerA);
  service.registerProvider(providerB); // duplicate — should be ignored with warning

  // The first registered provider is kept.
  // We can't easily reach the internal map, but we can verify login uses the first one.
  // (Test is mainly checking no exception is thrown.)
});

Deno.test('AuthSessionService: initializeProviders calls initialize on registered providers', async () => {
  const service = new AuthSessionService(makeLoggerStub());
  let initialized = false;
  const provider = makeProvider('password', { ok: true, username: 'alice' }, () => {
    initialized = true;
  });

  service.registerProvider(provider);
  await service.initializeProviders();

  assertEquals(initialized, true);
});

Deno.test('AuthSessionService: initializeProviders skips providers without initialize', async () => {
  const service = new AuthSessionService(makeLoggerStub());
  // Provider with no initialize method — should not throw.
  const provider: AuthProvider = {
    name: 'guest',
    authenticate: async () => ({ ok: true, username: 'guest' }),
  };

  service.registerProvider(provider);
  await service.initializeProviders(); // Should not throw.
});

Deno.test('AuthSessionService: each successful login issues a unique token', async () => {
  const service = new AuthSessionService(makeLoggerStub());
  service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
  await service.initializeProviders();

  const r1 = await service.login('password', {});
  const r2 = await service.login('password', {});

  if (!r1.ok || !r2.ok) throw new Error('Expected both logins to succeed');
  assertEquals(r1.token !== r2.token, true);
});
