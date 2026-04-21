import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { SceneContentComponent } from '../scene-content/scene-content.component';

/**
 * Profile scene shell routed at /profile.
 *
 * Hosts two child routes:
 * - /profile/security: change-password form and admin registration codes.
 * - /profile/settings: placeholder for user preferences.
 *
 * Bare /profile is handled by a default child redirect in app.routes.ts.
 * ProfileMenuComponent navigates directly to /profile/security or
 * /profile/settings to deep-link to a specific tab.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [SceneContentComponent, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly _router = inject(Router);

  /** Returns to the lobby route. */
  backToLobby(): void {
    void this._router.navigate(['/lobby']);
  }
}
