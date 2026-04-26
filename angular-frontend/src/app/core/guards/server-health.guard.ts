import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { serverStatusStore } from '../server-status/server-status.service';
import { authTokenStore } from '../auth/auth.service';

/**
 * Blocks navigation to guarded routes when the server reports an error-level
 * status. Redirects to /server-status so the user sees the issues list.
 *
 * Returns true when the server is healthy or has only warnings; returns a
 * UrlTree pointing to /server-status when status is 'error'.
 */
export const serverHealthGuard: CanActivateFn = () => {
  const router = inject(Router);
  return serverStatusStore.get()?.status !== 'error'
    ? true
    : router.createUrlTree(['/server-status']);
};

/**
 * Inverse of serverHealthGuard: applied to /server-status itself so that a
 * refresh after the server recovers does not strand the user on the error
 * page. When status is anything other than 'error', redirect to /lobby (or
 * /login when the user has no session) instead of rendering the page.
 */
export const serverStatusRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (serverStatusStore.get()?.status === 'error') {
    return true;
  }
  return router.createUrlTree([authTokenStore.get() ? '/lobby' : '/login']);
};
