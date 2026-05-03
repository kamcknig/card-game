import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { matchStartedStore } from '../../state/match-state';
import { activeLobbyGameIdStore } from '../../state/lobby-state';

/** Guards the /configuration route. Allows access only when the player is in
 * a lobby game that has not yet started. Any other state redirects to /lobby:
 * - match already in progress → use /match, not /configuration
 * - not in any lobby game → navigating away from /configuration in the pre-match
 *   phase removes the player from the game, so re-entry via history or URL bar
 *   is blocked until they explicitly rejoin. */
export const noActiveMatchGuard: CanActivateFn = () => {
  const router = inject(Router);
  return (activeLobbyGameIdStore.get() && !matchStartedStore.get())
    ? true
    : router.createUrlTree(['/lobby']);
};
