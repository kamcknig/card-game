import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { serverStatusStore } from '../server-status/server-status.service';

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
