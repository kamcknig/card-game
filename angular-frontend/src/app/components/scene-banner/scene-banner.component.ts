import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { authUsernameStore } from '../../core/auth/auth.service';
import { APP_VERSION } from '../../core/app-version';
import { serverVersionStore } from '../../state/server-version-state';
import { ProfileMenuComponent } from '../profile-menu/profile-menu.component';
import { ThemeToggleComponent } from '../ui/theme-toggle/theme-toggle.component';

/**
 * Shared banner header rendered at the top of every non-match scene.
 *
 * Projects scene-specific actions (e.g. Leave Game) via ng-content.
 * When the user is authenticated, also renders the profile icon menu.
 * Displays a small version pill with the frontend build version, and
 * appends the server version once the `serverHello` socket event lands.
 */
@Component({
  selector: 'app-scene-banner',
  standalone: true,
  imports: [ProfileMenuComponent, ThemeToggleComponent],
  templateUrl: './scene-banner.component.html',
  styleUrl: './scene-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneBannerComponent {
  private readonly _nanoStores = inject(NanostoresService);

  // Optional secondary line shown under the main title.
  readonly subtitle = input<string | null | undefined>(undefined);

  // Reactive username — determines whether the profile menu is rendered.
  readonly username = toSignal(this._nanoStores.useStore(authUsernameStore));

  /** Frontend bundle version — baked in at build time from package.json. */
  readonly clientVersion = APP_VERSION;

  /** Server version received via the `serverHello` socket event. */
  readonly serverVersion = toSignal(this._nanoStores.useStore(serverVersionStore));

  /**
   * Combined client + server version string for the action bar.
   * Renders `Client vX.Y.Z` until the server version is known, then
   * `Client vX.Y.Z · Server vX.Y.Z` once `serverHello` lands.
   */
  readonly versionLine = computed(() => {
    const server = this.serverVersion();
    return server
      ? `Client v${this.clientVersion} · Server v${server}`
      : `Client v${this.clientVersion}`;
  });
}
