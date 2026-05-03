import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { matchStartedStore } from '../../state/match-state';

/** Redirects to /lobby when a match is already in progress.
 * Prevents the user from landing on /configuration via browser history or
 * direct URL entry while an active match is running. */
export const noActiveMatchGuard: CanActivateFn = () => {
  const router = inject(Router);
  return matchStartedStore.get() ? router.createUrlTree(['/lobby']) : true;
};
