import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { SceneContentComponent } from '../scene-content/scene-content.component';

/**
 * Settings scene shell — sidebar nav with two tabs that swap the routed
 * content. The same shell is used by two top-level routes:
 * - /profile renders ProfileSecurityComponent (Profile tab: account /
 *   change password).
 * - /settings renders ProfileSettingsComponent (Settings tab: user
 *   preferences such as sound volume).
 *
 * ProfileMenuComponent navigates directly to /profile or /settings to
 * deep-link to a specific tab.
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
