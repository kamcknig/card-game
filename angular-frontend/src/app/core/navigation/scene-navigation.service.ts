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
 * Bridges sceneStore (nanostores) to the Angular Router.
 *
 * Subscribes to sceneStore and navigates the Angular Router when the scene
 * atom changes. Also listens for NavigationEnd events to keep sceneStore
 * accurate when the user navigates via browser back/forward buttons.
 *
 * A re-entrancy flag prevents the two subscriptions from creating a cycle.
 * Must be injected by AppComponent to activate.
 */
@Injectable({ providedIn: 'root' })
export class SceneNavigationService {
  private readonly _router = inject(Router);

  /** Prevents Router→sceneStore from immediately re-triggering sceneStore→Router. */
  private _isSyncingFromRouter = false;

  constructor() {
    // sceneStore → Router: navigate when the atom is updated externally.
    sceneStore.subscribe(scene => {
      if (this._isSyncingFromRouter) return;
      const path = SCENE_TO_PATH[scene];
      if (path && this._router.url !== path) {
        void this._router.navigate([path]);
      }
    });

    // Router → sceneStore: keep the atom accurate on browser back/forward.
    this._router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => {
        const url = (e as NavigationEnd).urlAfterRedirects;
        const scene = PATH_TO_SCENE[url];
        if (scene && sceneStore.get() !== scene) {
          this._isSyncingFromRouter = true;
          sceneStore.set(scene);
          this._isSyncingFromRouter = false;
        }
      });
  }
}
