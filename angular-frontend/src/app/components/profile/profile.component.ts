import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { NewPasswordFieldsComponent } from '../ui/new-password-fields/new-password-fields.component';
import { sceneStore } from '../../state/game-state';
import { profileTabStore, ProfileTab } from '../../state/profile-state';

/**
 * Profile scene.
 *
 * Hosts two sub-panes controlled by a left nav:
 * - Security: inline change-password form.
 * - Settings: placeholder content.
 *
 * The initial active pane is determined by profileTabStore, which is set by
 * ProfileMenuComponent before navigating here.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [SceneContentComponent, FormsModule, NewPasswordFieldsComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private readonly _authService = inject(AuthService);

  // Drives the active left-nav tab; initialized from profileTabStore in ngOnInit.
  readonly selectedNav = signal<ProfileTab>('security');

  // --- Change-password form state ---

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  /** Confirmation of {@link newPassword}; must match before submit is allowed. */
  readonly confirmNewPassword = signal('');
  readonly changePasswordError = signal<string | undefined>(undefined);
  readonly changePasswordSuccess = signal<string | undefined>(undefined);
  readonly changePasswordSubmitting = signal(false);

  /**
   * Reference to the shared primary/confirm password component rendered in
   * the Security pane. Used to read its `mismatch` signal when gating the
   * submit button.
   */
  readonly newPasswordFields = viewChild(NewPasswordFieldsComponent);

  ngOnInit(): void {
    // Honour the tab requested by the profile menu before navigation.
    this.selectedNav.set(profileTabStore.get());
  }

  /** Activates the given left-nav tab. */
  selectNav(tab: ProfileTab): void {
    this.selectedNav.set(tab);
  }

  /** Returns to the lobby scene. */
  backToLobby(): void {
    sceneStore.set('lobby');
  }

  /**
   * Submits the password change request.
   *
   * On success the server revokes every sibling session for this user while
   * leaving the caller's own session alive. Displays a success message and
   * clears the form — AuthService.changePassword handles the HTTP details.
   */
  async submitChangePassword(): Promise<void> {
    this.changePasswordError.set(undefined);
    this.changePasswordSuccess.set(undefined);

    const cur = this.currentPassword();
    const next = this.newPassword();
    if (!cur || !next) {
      this.changePasswordError.set('Both fields are required');
      return;
    }

    // Belt-and-braces: also checked by the disabled binding, but re-validate
    // here in case the form is submitted via Enter before the confirm field
    // loses focus.
    if (next !== this.confirmNewPassword()) {
      this.changePasswordError.set('Passwords do not match');
      return;
    }

    this.changePasswordSubmitting.set(true);
    try {
      const result = await this._authService.changePassword(cur, next);
      if (result.ok) {
        this.changePasswordSuccess.set(
          result.revokedSessions && result.revokedSessions > 0
            ? `Password updated — signed out ${result.revokedSessions} other session(s).`
            : 'Password updated.',
        );
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmNewPassword.set('');
      } else {
        this.changePasswordError.set(result.message ?? 'Password change failed');
      }
    } finally {
      this.changePasswordSubmitting.set(false);
    }
  }
}
