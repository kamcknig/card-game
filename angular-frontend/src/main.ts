import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { SocketService } from './app/core/socket-service/socket.service';
import { socketToGameEventMap } from './app/core/socket-service/socket-event-map';
import { AuthService, authTokenStore } from './app/core/auth/auth.service';
import { sceneStore } from './app/state/game-state';

bootstrapApplication(AppComponent, appConfig)
  .then(async appRef => {
    const injector = appRef.injector;
    const authService = injector.get(AuthService);
    const socketService = injector.get(SocketService);

    // Try to restore a previous auth session from localStorage.
    const hasValidToken = await authService.validateStoredToken();
    if (hasValidToken) {
      // Skip login, go straight to lobby and connect socket.
      sceneStore.set('lobby');
      socketService.setEventMap(socketToGameEventMap());
      // Warm searchable landscape data on startup so configuration search can filter locally.
      socketService.emit('requestSelectableSearchCatalog');
    }

    // Subscribe to auth token changes so the socket connects after a successful login.
    authTokenStore.subscribe(token => {
      if (token && !socketService.isConnected()) {
        socketService.setEventMap(socketToGameEventMap());
        // Warm searchable landscape data on startup so configuration search can filter locally.
        socketService.emit('requestSelectableSearchCatalog');
      }
    });
  })
  .catch((err) => console.error(err));
