import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SceneNames, sceneStore } from '../../state/game-state';

/** Maps SceneNames to Angular route path segments and back. */
const SCENE_TO_PATH: Record<SceneNames, string> = {
  login: '/login',
  lobby: '/lobby',
  profile: '/profile',
  configuration: '/configuration',
  match: '/match',
  gameSummary: '/game-summary',
};

const PATH_TO_SCENE: Record<string, SceneNames> = Object.fromEntries(
  Object.entries(SCENE_TO_PATH).map(([scene, path]) => [path, scene as SceneNames]),
);

/**
 * Returns the scene name that matches the top-level path segment of `url`.
 * Accepts child routes (e.g. '/profile/security' → 'profile').
 */
function urlToScene(url: string): SceneNames | undefined {
  const path = url.split('?')[0];
  // Match the top-level segment: '/profile' or '/profile/security' → '/profile'.
  const topLevel = '/' + (path.split('/')[1] ?? '');
  return PATH_TO_SCENE[topLevel];
}

/**
 * Bridges sceneStore (nanostores) to the Angular Router.
 *
 * - sceneStore → Router: when callers set the scene atom (socket events,
 *   components) the router navigates to the matching path.
 * - Router → sceneStore: NavigationEnd events write the active scene back into
 *   the atom so browser back/forward, refresh, and deep links stay in sync.
 *
 * On startup, the URL wins: the first sceneStore emission (the default atom
 * value) is ignored so a refresh on /match does not get overridden by the
 * store's default 'login' value. The initial NavigationEnd (or the current
 * router URL) then hydrates sceneStore to match the actual route.
 *
 * A re-entrancy flag breaks the sceneStore ↔ Router cycle.
 * Must be injected by AppComponent to activate.
 */
@Injectable({ providedIn: 'root' })
export class SceneNavigationService {
  private readonly _router = inject(Router);

  /** Prevents Router→sceneStore from immediately re-triggering sceneStore→Router. */
  private _isSyncingFromRouter = false;

  constructor() {
    // Nanostores fires the current value synchronously on subscribe. On
    // startup we want the URL (not the atom's default) to drive the initial
    // scene, so skip the first emission and only react to later changes.
    let skipInitialSceneEmission = true;

    // sceneStore → Router: navigate when the atom is updated externally.
    sceneStore.subscribe(scene => {
      if (skipInitialSceneEmission) {
        skipInitialSceneEmission = false;
        return;
      }
      if (this._isSyncingFromRouter) return;
      const path = SCENE_TO_PATH[scene];
      if (!path) return;
      // Allow child routes under the scene's top-level path (e.g. /profile/security)
      // to remain undisturbed when sceneStore is set to the same top-level scene.
      if (urlToScene(this._router.url) === scene) return;
      void this._router.navigate([path]);
    });

    // Router → sceneStore: keep the atom accurate on initial navigation,
    // direct URL loads, and browser back/forward.
    this._router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => {
        const scene = urlToScene((e as NavigationEnd).urlAfterRedirects);
        if (scene && sceneStore.get() !== scene) {
          this._isSyncingFromRouter = true;
          sceneStore.set(scene);
          this._isSyncingFromRouter = false;
        }
      });

    // If the router completed its initial navigation before this service was
    // constructed, NavigationEnd would not fire for it. Sync sceneStore from
    // the current URL as a fallback so the atom matches the visible route.
    const currentScene = urlToScene(this._router.url);
    if (currentScene && sceneStore.get() !== currentScene) {
      this._isSyncingFromRouter = true;
      sceneStore.set(currentScene);
      this._isSyncingFromRouter = false;
    }
  }
}
