import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { authTokenStore } from '../auth/auth.service';
import {
  ServerStatusSnapshot,
  serverStatusStore,
} from '../server-status/server-status.service';
import { serverHealthGuard, serverStatusRedirectGuard } from './server-health.guard';

/**
 * Stub Router — only createUrlTree is exercised by the guards. Returning a
 * typed-but-inert UrlTree lets each guard's redirect branch be observed.
 */
class RouterStub {
  createUrlTree = jest.fn().mockImplementation((segments: string[]) => ({ segments } as unknown as UrlTree));
}

const snapshot = (status: ServerStatusSnapshot['status']): ServerStatusSnapshot => ({
  status,
  issues: [],
  backend: 'kv',
  startedAt: 0,
});

describe('serverHealthGuard', () => {
  let routerStub: RouterStub;

  beforeEach(() => {
    routerStub = new RouterStub();
    TestBed.configureTestingModule({
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: Router, useValue: routerStub },
      ],
    });
    serverStatusStore.set(undefined);
  });

  it('allows navigation when the snapshot is healthy', () => {
    serverStatusStore.set(snapshot('healthy'));

    const result = TestBed.runInInjectionContext(() =>
      serverHealthGuard({} as any, {} as any),
    );

    expect(result).toBe(true);
    expect(routerStub.createUrlTree).not.toHaveBeenCalled();
  });

  it('allows navigation when the snapshot is warning (treated as non-error)', () => {
    serverStatusStore.set(snapshot('warning'));

    const result = TestBed.runInInjectionContext(() =>
      serverHealthGuard({} as any, {} as any),
    );

    expect(result).toBe(true);
    expect(routerStub.createUrlTree).not.toHaveBeenCalled();
  });

  it('allows navigation when no snapshot has been fetched yet', () => {
    // serverStatusStore is undefined (e.g. before bootstrap fetch completes).
    const result = TestBed.runInInjectionContext(() =>
      serverHealthGuard({} as any, {} as any),
    );

    expect(result).toBe(true);
    expect(routerStub.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /server-status when the snapshot reports an error', () => {
    serverStatusStore.set(snapshot('error'));

    const result = TestBed.runInInjectionContext(() =>
      serverHealthGuard({} as any, {} as any),
    );

    expect(result).not.toBe(true);
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/server-status']);
  });
});

describe('serverStatusRedirectGuard', () => {
  let routerStub: RouterStub;

  beforeEach(() => {
    routerStub = new RouterStub();
    TestBed.configureTestingModule({
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: Router, useValue: routerStub },
      ],
    });
    serverStatusStore.set(undefined);
    authTokenStore.set(undefined);
  });

  it('allows the /server-status page to render when the snapshot is error', () => {
    serverStatusStore.set(snapshot('error'));
    authTokenStore.set('valid-token');

    const result = TestBed.runInInjectionContext(() =>
      serverStatusRedirectGuard({} as any, {} as any),
    );

    expect(result).toBe(true);
    expect(routerStub.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects authenticated users to /lobby when the snapshot is healthy', () => {
    serverStatusStore.set(snapshot('healthy'));
    authTokenStore.set('valid-token');

    const result = TestBed.runInInjectionContext(() =>
      serverStatusRedirectGuard({} as any, {} as any),
    );

    expect(result).not.toBe(true);
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/lobby']);
  });

  it('redirects unauthenticated users to /login when the snapshot is healthy', () => {
    serverStatusStore.set(snapshot('healthy'));
    authTokenStore.set(undefined);

    const result = TestBed.runInInjectionContext(() =>
      serverStatusRedirectGuard({} as any, {} as any),
    );

    expect(result).not.toBe(true);
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('redirects to /lobby when no snapshot has been fetched yet (treated as non-error)', () => {
    // No snapshot set — guard should bounce the user to the appropriate landing page
    // rather than render the error UI for an unknown state.
    authTokenStore.set('valid-token');

    const result = TestBed.runInInjectionContext(() =>
      serverStatusRedirectGuard({} as any, {} as any),
    );

    expect(result).not.toBe(true);
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/lobby']);
  });
});
