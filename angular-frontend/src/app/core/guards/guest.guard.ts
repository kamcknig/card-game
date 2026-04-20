import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { authTokenStore } from '../auth/auth.service';

/** Redirects authenticated users away from guest-only routes (e.g. /login) to /lobby. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return authTokenStore.get() ? router.createUrlTree(['/lobby']) : true;
};
