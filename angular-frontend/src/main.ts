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
    // On error, navigate to /server-status (initial navigation is disabled in
    // app.config.ts so this is the only place that triggers it) and skip the
    // rest of bootstrap.
    const router = injector.get(Router);
    await serverStatusService.fetchOnce();
    if (serverStatusStore.get()?.status === 'error') {
      await router.navigate(['/server-status']);
      return;
    }

    // Try to restore a previous auth session from localStorage. validateStoredToken
    // clears the stored token when the server reports it as invalid, so by the time
    // we trigger initial navigation below the auth guards see the correct token state.
    const hasValidToken = await authService.validateStoredToken();
    // Trigger the deferred initial navigation now that server health and auth
    // state are settled. This preserves the URL the user refreshed on (e.g.
    // /match, /profile/security) but ensures guards evaluate against the
    // cleared-or-confirmed token, not the stale localStorage value.
    await router.initialNavigation();
    if (hasValidToken) {
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
