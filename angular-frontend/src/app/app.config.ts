import { APP_INITIALIZER, ApplicationConfig, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { SOCKET_EVENT_MAP, socketToGameEventMap } from './core/socket-service/socket-event-map';
import { NANOSTORES, NanostoresService } from '@nanostores/angular';
import { SocketService } from './core/socket-service/socket.service';
import { PIXI_APP } from './core/pixi-application.token';
import { Application, TexturePool } from 'pixi.js';
import { pixiFactory, pixiInstance } from './pixi-application.factory';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: NANOSTORES, useClass: NanostoresService },
    provideAppInitializer(pixiFactory),
    {
      provide: PIXI_APP,
      useValue: pixiInstance
    }
  ]
};
