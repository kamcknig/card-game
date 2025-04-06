import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { SOCKET_EVENT_MAP, socketToGameEventMap } from './core/socket-service/socket-event-map';
import { NANOSTORES, NanostoresService } from '@nanostores/angular';
import { SocketService } from './core/socket-service/socket.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: SOCKET_EVENT_MAP, useValue: socketToGameEventMap },
    { provide: NANOSTORES, useClass: NanostoresService },
  ]
};
