import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { sceneStore } from '../../state/game-state';
import { profileTabStore } from '../../state/profile-state';

/**
 * Profile scene shell routed at /profile.
 *
 * Hosts two child routes:
 * - /profile/security: change-password form and admin registration codes.
 * - /profile/settings: placeholder for user preferences.
 *
 * On init, redirects to the child route specified by profileTabStore, which is
 * set by ProfileMenuComponent before navigating here to deep-link to a tab.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [SceneContentComponent, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  ngOnInit(): void {
    // Only redirect from the bare /profile path. If the URL already targets a
    // specific child route (/profile/security or /profile/settings), respect
    // it — this keeps refresh and deep-link navigation on the current tab.
    // The '' → 'security' child redirect in app.routes.ts handles the bare
    // /profile case when profileTabStore has its default value; the explicit
    // navigation below covers ProfileMenuComponent deep-linking to 'settings'.
    const url = this._router.url.split('?')[0];
    if (url === '/profile' || url === '/profile/') {
      void this._router.navigate([profileTabStore.get()], { relativeTo: this._route });
    }
  }

  /** Returns to the lobby scene. */
  backToLobby(): void {
    sceneStore.set('lobby');
  }
}
