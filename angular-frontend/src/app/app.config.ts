import {
  ApplicationConfig,
  provideAppInitializer,
  provideExperimentalZonelessChangeDetection,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { NANOSTORES, NanostoresService } from '@nanostores/angular';
import { PIXI_APP } from './core/pixi-application.token';
import { pixiFactory, pixiInstance } from './core/pixi-application.factory';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes),
    { provide: NANOSTORES, useClass: NanostoresService },
    provideAppInitializer(pixiFactory),
    {
      provide: PIXI_APP,
      useValue: pixiInstance
    }
  ]
};
