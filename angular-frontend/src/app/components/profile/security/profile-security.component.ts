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
import { AuthService, authEmailStore, authIsAdminStore, authNeedsEmailStore, authUsernameStore } from '../../../core/auth/auth.service';
import { NewPasswordFieldsComponent } from '../../ui/new-password-fields/new-password-fields.component';

/** Intentionally permissive — the server performs the authoritative check. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Security settings pane routed at /profile/security.
 *
 * Handles the following sections:
 * - **Account** (top) — displays the username (always read-only) and the
 *   user's email address. When the user has no email attached (legacy account),
 *   the section renders an email-attachment form so the user can add one.
 *   On success the email is shown read-only and a confirmation notice is
 *   displayed. Once set, the email is never editable here (out of scope).
 * - **Change password** — existing in-app password rotation form.
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

  /**
   * The currently authenticated username, shown read-only in the Account card.
   * Sourced from the auth store so it stays in sync with the current session.
   */
  readonly username = toSignal(this._nanoService.useStore(authUsernameStore), {
    initialValue: authUsernameStore.get(),
  });

  /**
   * True when the user has no email address attached to their account.
   * Controls which sub-view the Account card renders: the add-email form
   * (true) or the read-only email display (false).
   */
  readonly needsEmail = toSignal(this._nanoService.useStore(authNeedsEmailStore), {
    initialValue: authNeedsEmailStore.get(),
  });

  /**
   * The email address attached to this account (null when not yet set).
   * Sourced from the auth store so it reflects the latest server response.
   * Displayed read-only in the Account card when `needsEmail` is false.
   */
  readonly authEmail = toSignal(this._nanoService.useStore(authEmailStore), {
    initialValue: authEmailStore.get(),
  });

  // --- Add-email form state ---

  /** Email address entered in the add-email form. */
  readonly attachEmailValue = signal('');
  /** Current password entered for re-authentication in the add-email form. */
  readonly attachEmailPassword = signal('');
  /**
   * Availability-check state for the email field.
   * `checking` is true while the async check is in flight.
   * `error` carries a user-facing message when the email is unavailable.
   */
  readonly attachEmailStatus = signal<{ checking: boolean; error?: string }>({ checking: false });
  /** Inline error message from the add-email form submission. */
  readonly attachEmailError = signal<string | undefined>(undefined);
  /** Success message shown after a successful email attachment. */
  readonly attachEmailSuccess = signal<string | undefined>(undefined);
  /** True while the add-email form submission is in flight. */
  readonly attachEmailSubmitting = signal(false);
  /**
   * The email value that was successfully attached, used to render it
   * read-only with a "Pending confirmation" badge after form submission.
   */
  readonly attachedEmail = signal<string | undefined>(undefined);

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
   * Checks whether the email entered in the add-email form is already
   * registered, firing on `blur` of the email input.
   *
   * Updates `attachEmailStatus` with a checking spinner while the request is
   * in flight, then settles to either cleared (available) or an inline error
   * (taken). Empty values clear the status without making a request.
   */
  async onAttachEmailBlur(): Promise<void> {
    const email = this.attachEmailValue().trim();
    if (!email) {
      this.attachEmailStatus.set({ checking: false });
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      this.attachEmailStatus.set({ checking: false, error: 'Enter a valid email address' });
      return;
    }
    this.attachEmailStatus.set({ checking: true });
    const available = await this._authService.checkEmailAvailability(email);
    this.attachEmailStatus.set({
      checking: false,
      error: available ? undefined : 'Email is already registered',
    });
  }

  /**
   * Submits the add-email form.
   *
   * Re-authenticates on the server via the current password, then calls
   * `AuthService.attachEmail`. On success, transitions the Account card from
   * the add-email form to the read-only email view and shows a confirmation
   * message. Inline errors are shown for validation or server failures.
   */
  async submitAttachEmail(): Promise<void> {
    this.attachEmailError.set(undefined);
    this.attachEmailSuccess.set(undefined);

    const email = this.attachEmailValue().trim();
    const password = this.attachEmailPassword();
    if (!email || !password) {
      this.attachEmailError.set('Both email and password are required');
      return;
    }

    // Do not submit when the blur check has already reported the email taken.
    if (this.attachEmailStatus().error) {
      this.attachEmailError.set(this.attachEmailStatus().error);
      return;
    }

    this.attachEmailSubmitting.set(true);
    try {
      const result = await this._authService.attachEmail(email, password);
      if (result.ok) {
        // Record the attached email so the success view can display it.
        this.attachedEmail.set(email);
        this.attachEmailSuccess.set(
          'Confirmation email sent — check your inbox.',
        );
        // Clear the form inputs; the success view replaces the form.
        this.attachEmailValue.set('');
        this.attachEmailPassword.set('');
      } else {
        this.attachEmailError.set(result.message ?? 'Failed to attach email');
      }
    } finally {
      this.attachEmailSubmitting.set(false);
    }
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
