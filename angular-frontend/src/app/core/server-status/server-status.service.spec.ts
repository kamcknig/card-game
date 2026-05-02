import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  ServerStatusService,
  ServerStatusSnapshot,
  serverStatusStore,
} from './server-status.service';

/**
 * Builds a minimal Response-like object whose .json() resolves to the given body.
 * The service only awaits .json() — status code/headers are not inspected — so
 * this is enough to exercise both success and JSON-parse-failure paths.
 */
const fakeResponse = (jsonImpl: () => Promise<unknown>): Response =>
  ({ json: jsonImpl } as unknown as Response);

describe('ServerStatusService.fetchOnce', () => {
  let service: ServerStatusService;
  let consoleWarnSpy: jest.SpyInstance;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(ServerStatusService);
    serverStatusStore.set(undefined);
    // Quiet console.warn during the warning-issue assertion so it doesn't
    // pollute test output but still asserts the spy was called.
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    globalThis.fetch = originalFetch;
  });

  it('writes the parsed snapshot to serverStatusStore on a successful fetch', async () => {
    const snapshot: ServerStatusSnapshot = {
      status: 'healthy',
      issues: [],
      backend: 'kv',
      startedAt: 1_700_000_000_000,
    };
    globalThis.fetch = jest.fn().mockResolvedValue(fakeResponse(() => Promise.resolve(snapshot)));

    await service.fetchOnce();

    expect(serverStatusStore.get()).toEqual(snapshot);
  });

  it('logs each warning-level issue via console.warn', async () => {
    const snapshot: ServerStatusSnapshot = {
      status: 'warning',
      issues: [
        { level: 'warning', code: 'SLOW_OPEN', message: 'Storage slow to open' },
        { level: 'warning', code: 'STALE_CACHE', message: 'Cache primer skipped' },
        { level: 'error', code: 'UNRELATED_ERROR', message: 'should not be warned' },
      ],
      backend: 'supabase',
      startedAt: 0,
    };
    globalThis.fetch = jest.fn().mockResolvedValue(fakeResponse(() => Promise.resolve(snapshot)));

    await service.fetchOnce();

    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    expect(consoleWarnSpy).toHaveBeenCalledWith('[server-status] SLOW_OPEN: Storage slow to open');
    expect(consoleWarnSpy).toHaveBeenCalledWith('[server-status] STALE_CACHE: Cache primer skipped');
  });

  it('writes a synthetic SERVER_UNREACHABLE snapshot when fetch rejects', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('network down'));

    await service.fetchOnce();

    const written = serverStatusStore.get();
    expect(written?.status).toBe('error');
    expect(written?.backend).toBe('unknown');
    expect(written?.startedAt).toBe(0);
    expect(written?.issues).toEqual([
      { level: 'error', code: 'SERVER_UNREACHABLE', message: 'Could not reach server.' },
    ]);
  });

  it('writes a synthetic SERVER_UNREACHABLE snapshot when the body is not valid JSON', async () => {
    // res.json() throwing simulates the dev-proxy passing through index.html
    // (or any non-JSON body) — the service should treat that the same as a
    // network failure rather than crash bootstrap.
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(fakeResponse(() => Promise.reject(new SyntaxError('Unexpected token <'))));

    await service.fetchOnce();

    expect(serverStatusStore.get()?.status).toBe('error');
    expect(serverStatusStore.get()?.issues[0]?.code).toBe('SERVER_UNREACHABLE');
  });
});
