import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { AuthService, authIsAdminStore } from '../../../core/auth/auth.service';
import { NewPasswordFieldsComponent } from '../../ui/new-password-fields/new-password-fields.component';

/**
 * Security settings pane routed at /profile/security.
 *
 * Handles the change-password form.
 */
@Component({
  selector: 'app-profile-security',
  standalone: true,
  imports: [FormsModule, NewPasswordFieldsComponent],
  templateUrl: './profile-security.component.html',
  styleUrl: './profile-security.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSecurityComponent {
  private readonly _authService = inject(AuthService);
  private readonly _nanoService = inject(NanostoresService);

  /** True when the logged-in user has admin privileges. */
  readonly isAdmin = toSignal(this._nanoService.useStore(authIsAdminStore), {
    initialValue: authIsAdminStore.get(),
  });

  // --- Change-password form state ---

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  /** Confirmation of {@link newPassword}; must match before submit is allowed. */
  readonly confirmNewPassword = signal('');
  readonly changePasswordError = signal<string | undefined>(undefined);
  readonly changePasswordSuccess = signal<string | undefined>(undefined);
  readonly changePasswordSubmitting = signal(false);

  /**
   * Reference to the shared primary/confirm password component.
   * Used to read its `mismatch` signal when gating the submit button.
   */
  readonly newPasswordFields = viewChild(NewPasswordFieldsComponent);

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
