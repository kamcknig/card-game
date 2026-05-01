import { provideZoneChangeDetection } from "@angular/core";
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import {
  AuthService,
  authIsAdminStore,
  authTokenStore,
  authUsernameStore,
} from './app/core/auth/auth.service';
import { SocketEventMapService } from './app/core/socket-service/socket-event-map.service';
import { ServerStatusService, serverStatusStore } from './app/core/server-status/server-status.service';
import { Router } from '@angular/router';

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
    }

    // Subscribe to auth token changes so the socket lifecycle follows session
    // state: connect after a fresh login (handlers registered on first call,
    // socket reopened on subsequent calls), and disconnect on logout or
    // external session invalidation (see the storage event handler below).
    authTokenStore.subscribe(token => {
      if (token) {
        socketEventMapService.connect();
      } else {
        socketEventMapService.disconnect();
      }
    });

    // Single-session-per-user is enforced server-side: every successful login
    // calls removeSessionsForUsername(), revoking any other tabs/devices for
    // the same user. This tab's nanostore atoms do NOT subscribe to
    // localStorage 'storage' events natively (those only fire in OTHER tabs),
    // so without this listener a tab whose session was revoked elsewhere
    // would keep its stale in-memory token, its still-open socket would no
    // longer be backed by a valid session, and the user would see the UI
    // silently degrade. When another tab clears or replaces the authToken
    // we mirror that into this tab's atoms so authGuard kicks the user back
    // to /login on the next navigation, the socket disconnects via the
    // subscription above, and there is no zombie session left around.
    window.addEventListener('storage', event => {
      // Only react to changes on the auth token key from another tab/window.
      if (event.key !== 'authToken' || event.storageArea !== localStorage) {
        return;
      }
      const externalToken = event.newValue ?? undefined;
      const currentToken = authTokenStore.get();
      if (externalToken === currentToken) return;

      if (!externalToken) {
        // Another tab logged out — mirror the logout into this tab.
        authTokenStore.set(undefined);
        authUsernameStore.set(undefined);
        authIsAdminStore.set(false);
        void router.navigate(['/login']);
      } else {
        // Another tab logged in with a new token. Do NOT mirror the token into
        // authTokenStore — that would trigger the authTokenStore subscriber to
        // call connect(), causing this tab's socket to compete with the new tab
        // and kick it. Instead, disconnect this tab's socket permanently and
        // clear local auth state so this tab yields the session to the new tab.
        socketEventMapService.disconnect();
        authTokenStore.set(undefined);
        authUsernameStore.set(undefined);
        authIsAdminStore.set(false);
        void router.navigate(['/login']);
      }
    });
  })
  .catch(err => console.error(err));
