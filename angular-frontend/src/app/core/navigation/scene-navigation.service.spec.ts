import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { sceneStore } from '../../state/game-state';
import { SceneNavigationService } from './scene-navigation.service';

/**
 * Stub Router exposing the surface the service uses:
 * - events (Observable of router events)
 * - url (string getter)
 * - navigate (Promise-returning spy)
 */
class RouterStub {
  readonly events = new Subject<unknown>();
  url = '/';
  navigate = jest.fn().mockResolvedValue(true);

  emitNavigationEnd(urlAfterRedirects: string) {
    this.events.next(new NavigationEnd(1, urlAfterRedirects, urlAfterRedirects));
  }
}

describe('SceneNavigationService', () => {
  let routerStub: RouterStub;

  const construct = () => {
    return TestBed.runInInjectionContext(() => new SceneNavigationService());
  };

  beforeEach(() => {
    routerStub = new RouterStub();
    sceneStore.set('login');
    TestBed.configureTestingModule({
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: Router, useValue: routerStub },
      ],
    });
  });

  it('skips the initial sceneStore emission so the URL drives the startup scene', () => {
    routerStub.url = '/match';
    sceneStore.set('login');

    construct();

    // The initial nanostores emission fires synchronously on subscribe with
    // value 'login'. The service must not treat this as a navigation request.
    expect(routerStub.navigate).not.toHaveBeenCalledWith(['/login']);
  });

  it('syncs sceneStore from the current router URL as a fallback on construction', () => {
    routerStub.url = '/match';
    sceneStore.set('login');

    construct();

    expect(sceneStore.get()).toBe('match');
  });

  it('navigates the Router when sceneStore changes to a different scene', async () => {
    routerStub.url = '/lobby';
    sceneStore.set('lobby');

    construct();
    routerStub.navigate.mockClear();

    sceneStore.set('match');

    expect(routerStub.navigate).toHaveBeenCalledWith(['/match']);
  });

  it('does not navigate when the top-level URL already matches the new scene', () => {
    // Starting on /profile/security and setting scene to 'profile' must not
    // bounce back to /profile (which would lose the child route).
    routerStub.url = '/profile/security';
    sceneStore.set('profile');

    construct();
    routerStub.navigate.mockClear();

    sceneStore.set('profile');

    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('updates sceneStore when the Router emits NavigationEnd (e.g. back/forward)', () => {
    routerStub.url = '/lobby';
    sceneStore.set('lobby');

    construct();
    routerStub.navigate.mockClear();

    routerStub.url = '/profile/security';
    routerStub.emitNavigationEnd('/profile/security');

    expect(sceneStore.get()).toBe('profile');
    // The URL already matches the new scene so no re-navigation fires.
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('does not loop when Router→sceneStore sync triggers the sceneStore subscriber', () => {
    routerStub.url = '/lobby';
    sceneStore.set('lobby');

    construct();
    routerStub.navigate.mockClear();

    // Simulate the Router navigating the user to /match (e.g. browser forward
    // button). The service's NavigationEnd handler will sceneStore.set('match');
    // that subscriber must not then call navigate(['/match']) which would loop.
    routerStub.url = '/match';
    routerStub.emitNavigationEnd('/match');

    expect(sceneStore.get()).toBe('match');
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('maps child route URLs back to their parent scene', () => {
    // /profile/security and /profile/settings both map to the 'profile' scene.
    routerStub.url = '/profile/settings';
    sceneStore.set('login');

    construct();

    expect(sceneStore.get()).toBe('profile');
  });

  it('ignores unknown paths', () => {
    routerStub.url = '/unknown-path';
    sceneStore.set('login');

    construct();

    // Unknown path → no scene mapping → sceneStore stays at its initial value.
    expect(sceneStore.get()).toBe('login');
  });
});
