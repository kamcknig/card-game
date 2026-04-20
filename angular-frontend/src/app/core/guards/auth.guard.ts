import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { authTokenStore } from '../auth/auth.service';

/** Redirects unauthenticated users to /login. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return authTokenStore.get() ? true : router.createUrlTree(['/login']);
};
