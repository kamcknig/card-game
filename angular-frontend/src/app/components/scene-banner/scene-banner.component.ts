import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { authUsernameStore } from '../../core/auth/auth.service';
import { ProfileMenuComponent } from '../profile-menu/profile-menu.component';

/**
 * Shared banner header rendered at the top of every non-match scene.
 *
 * Projects scene-specific actions (e.g. Leave Game) via ng-content.
 * When the user is authenticated, also renders the profile icon menu.
 */
@Component({
  selector: 'app-scene-banner',
  standalone: true,
  imports: [ProfileMenuComponent],
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
}
