import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { AuthService, authTokenStore, pendingRegistrationCodeStore } from './app/core/auth/auth.service';
import { SocketEventMapService } from './app/core/socket-service/socket-event-map.service';
import { ServerStatusService, serverStatusStore } from './app/core/server-status/server-status.service';
import { Router } from '@angular/router';

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
    const socketEventMapService = injector.get(SocketEventMapService);
    const serverStatusService = injector.get(ServerStatusService);

    // Check server health before any auth or socket work.
    // On error, redirect to /server-status and skip the rest of bootstrap.
    await serverStatusService.fetchOnce();
    if (serverStatusStore.get()?.status === 'error') {
      injector.get(Router).navigate(['/server-status']);
      return;
    }

    // Try to restore a previous auth session from localStorage.
    const hasValidToken = await authService.validateStoredToken();
    if (hasValidToken) {
      // URL-based routing keeps the user on the page they refreshed on
      // (e.g. /match on match rejoin, /profile/security). The Angular Router's
      // initial navigation and auth guards handle invalid destinations:
      // /login with a valid token is redirected to /lobby by guestGuard.
      // Server events (matchReady, matchConfigurationUpdated) update the route
      // if the user's session state requires a different scene.
      socketEventMapService.connect();
      // A valid session means the user goes to the lobby; discard any staged
      // registration code so it is not consumed on a future logout/revisit.
      pendingRegistrationCodeStore.set(undefined);
    }

    // Subscribe to auth token changes so the socket connects after a successful
    // fresh login. SocketEventMapService.connect() is idempotent — the internal
    // _initialized guard prevents double-init on refresh.
    authTokenStore.subscribe(token => {
      if (token) {
        socketEventMapService.connect();
      }
    });
  })
  .catch(err => console.error(err));
