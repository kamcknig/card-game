import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';

import { routes } from './app.routes';
import { NANOSTORES, NanostoresService } from '@nanostores/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // Initial navigation is disabled so main.ts can resolve the server-status
    // and stored-token checks before guards evaluate. With the default
    // enabledNonBlocking mode, authGuard would run against a stale token in
    // localStorage and drop the user at /lobby before validateStoredToken()
    // had a chance to clear it.
    provideRouter(routes, withDisabledInitialNavigation()),
    { provide: NANOSTORES, useClass: NanostoresService },
  ]
};
