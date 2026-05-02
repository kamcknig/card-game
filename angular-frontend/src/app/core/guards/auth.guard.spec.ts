import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { authTokenStore } from '../auth/auth.service';
import { authGuard } from './auth.guard';

/**
 * Stub Router — only createUrlTree is exercised by the guard. Returning a
 * typed-but-inert UrlTree lets the guard's redirect branch be observed.
 */
class RouterStub {
  createUrlTree = jest.fn().mockImplementation((segments: string[]) => ({ segments } as unknown as UrlTree));
}

describe('authGuard', () => {
  let routerStub: RouterStub;

  beforeEach(() => {
    routerStub = new RouterStub();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: routerStub },
      ],
    });
    // Reset auth token between tests.
    authTokenStore.set(undefined);
  });

  it('allows navigation when an auth token is present', () => {
    authTokenStore.set('valid-token');

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any),
    );

    expect(result).toBe(true);
    expect(routerStub.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /login when no auth token is present', () => {
    authTokenStore.set(undefined);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any),
    );

    expect(result).not.toBe(true);
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
