import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { SocketService } from './app/core/socket-service/socket.service';
import { socketToGameEventMap } from './app/core/socket-service/socket-event-map';
import { AuthService, authTokenStore, pendingRegistrationCodeStore } from './app/core/auth/auth.service';

// Stage any registration code from the URL before the app bootstraps so that
// LoginComponent can read pendingRegistrationCodeStore in its constructor.
// If the user has a valid session this value is ignored — validateStoredToken
// below will navigate to the lobby before the login scene is ever shown.
const _startupParams = new URLSearchParams(window.location.search);
const _startupRegCode = _startupParams.get('registrationCode');
if (_startupRegCode) {
  pendingRegistrationCodeStore.set(_startupRegCode.trim());
}

bootstrapApplication(AppComponent, appConfig)
  .then(async appRef => {
    const injector = appRef.injector;
    const authService = injector.get(AuthService);
    const socketService = injector.get(SocketService);

    // Guard against double-init: nanostores subscribe fires immediately with the
    // current value, so without this flag it would call connectSocket() twice on
    // refresh (once from the hasValidToken block, once from the subscribe callback).
    let socketInitialized = false;

    const connectSocket = () => {
      if (socketInitialized) return;
      socketInitialized = true;
      socketService.setEventMap(socketToGameEventMap());
      // Warm searchable landscape data on startup so configuration search can filter locally.
      socketService.emit('requestSelectableSearchCatalog');
    };

    // Try to restore a previous auth session from localStorage.
    const hasValidToken = await authService.validateStoredToken();
    if (hasValidToken) {
      // URL-based routing keeps the user on the page they refreshed on
      // (e.g. /match on match rejoin, /profile/security). The Angular Router's
      // initial navigation and auth guards handle invalid destinations:
      // /login with a valid token is redirected to /lobby by guestGuard.
      // Server events (matchReady, matchConfigurationUpdated) update sceneStore
      // if the user's session state requires a different scene.
      connectSocket();
      // A valid session means the user goes to the lobby; discard any staged
      // registration code so it is not consumed on a future logout/revisit.
      pendingRegistrationCodeStore.set(undefined);
    }

    // Subscribe to auth token changes so the socket connects after a successful
    // fresh login. The guard above prevents double-init on refresh.
    authTokenStore.subscribe(token => {
      if (token) {
        connectSocket();
      }
    });
  })
  .catch((err) => console.error(err));
