import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { authTokenStore } from '../auth/auth.service';
import { guestGuard } from './guest.guard';

class RouterStub {
  createUrlTree = jest.fn().mockImplementation((segments: string[]) => ({ segments } as unknown as UrlTree));
}

describe('guestGuard', () => {
  let routerStub: RouterStub;

  beforeEach(() => {
    routerStub = new RouterStub();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: routerStub },
      ],
    });
    authTokenStore.set(undefined);
  });

  it('allows navigation when the user is not authenticated', () => {
    authTokenStore.set(undefined);

    const result = TestBed.runInInjectionContext(() =>
      guestGuard({} as any, {} as any),
    );

    expect(result).toBe(true);
    expect(routerStub.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects authenticated users away from guest-only routes to /lobby', () => {
    authTokenStore.set('valid-token');

    const result = TestBed.runInInjectionContext(() =>
      guestGuard({} as any, {} as any),
    );

    expect(result).not.toBe(true);
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/lobby']);
  });
});
