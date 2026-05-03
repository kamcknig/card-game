import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { activeLobbyGameIdStore } from '../../state/lobby-state';
import { matchStartedStore } from '../../state/match-state';
import { noActiveMatchGuard } from './match-started.guard';

/**
 * Stub Router — only createUrlTree is exercised by the guard. Returning a
 * typed-but-inert UrlTree lets the guard's redirect branch be observed.
 */
class RouterStub {
  createUrlTree = jest.fn().mockImplementation((segments: string[]) => ({ segments } as unknown as UrlTree));
}

describe('noActiveMatchGuard', () => {
  let routerStub: RouterStub;

  beforeEach(() => {
    routerStub = new RouterStub();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: routerStub },
      ],
    });
    // Reset stores between tests so each scenario starts from a clean slate.
    activeLobbyGameIdStore.set(undefined);
    matchStartedStore.set(false);
  });

  it('allows /configuration when in a lobby game and the match has not started', () => {
    activeLobbyGameIdStore.set('game-1');
    matchStartedStore.set(false);

    const result = TestBed.runInInjectionContext(() =>
      noActiveMatchGuard({} as any, {} as any),
    );

    expect(result).toBe(true);
    expect(routerStub.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /lobby when the match has already started', () => {
    // Active match: the player should be on /match, not /configuration.
    activeLobbyGameIdStore.set('game-1');
    matchStartedStore.set(true);

    const result = TestBed.runInInjectionContext(() =>
      noActiveMatchGuard({} as any, {} as any),
    );

    expect(result).not.toBe(true);
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/lobby']);
  });

  it('redirects to /lobby when not attached to any lobby game', () => {
    // No active game: direct URL entry / history navigation must not allow
    // re-entry into /configuration after leaving in the pre-match phase.
    activeLobbyGameIdStore.set(undefined);
    matchStartedStore.set(false);

    const result = TestBed.runInInjectionContext(() =>
      noActiveMatchGuard({} as any, {} as any),
    );

    expect(result).not.toBe(true);
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/lobby']);
  });

  it('redirects to /lobby when neither flag is set', () => {
    activeLobbyGameIdStore.set(undefined);
    matchStartedStore.set(false);

    const result = TestBed.runInInjectionContext(() =>
      noActiveMatchGuard({} as any, {} as any),
    );

    expect(result).not.toBe(true);
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/lobby']);
  });
});
