import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { SocketService } from './app/core/socket-service/socket.service';
import { socketToGameEventMap } from './app/core/socket-service/socket-event-map';

bootstrapApplication(AppComponent, appConfig)
  .then(appRef => {
    const injector = appRef.injector;
    const socketService = injector.get(SocketService);
    socketService.setEventMap(socketToGameEventMap());
  })
  .catch((err) => console.error(err));
