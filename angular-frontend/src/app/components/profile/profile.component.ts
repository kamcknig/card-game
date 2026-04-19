import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { AuthService, authIsAdminStore } from '../../core/auth/auth.service';
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
  imports: [SceneContentComponent, FormsModule, NewPasswordFieldsComponent, DatePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private readonly _authService = inject(AuthService);
  private readonly _nanoService = inject(NanostoresService);

  // Drives the active left-nav tab; initialized from profileTabStore in ngOnInit.
  readonly selectedNav = signal<ProfileTab>('security');

  // --- Admin state ---

  /** True when the logged-in user has admin privileges. */
  readonly isAdmin = toSignal(this._nanoService.useStore(authIsAdminStore), {
    initialValue: authIsAdminStore.get(),
  });

  // --- Registration code form state ---

  /** Number of registrations the new code may be used for. */
  readonly regCodeMaxUses = signal(1);

  /**
   * Expiry for the new code in days from now, or null for no expiry.
   * The user enters a number in the form; null means the field is empty.
   */
  readonly regCodeExpiresInDays = signal<number | null>(null);

  /** The code string returned after a successful creation. */
  readonly regCodeResult = signal<string | undefined>(undefined);

  /** Error message from the last create-code attempt, if any. */
  readonly regCodeError = signal<string | undefined>(undefined);

  /** True while a create-code request is in-flight. */
  readonly regCodeSubmitting = signal(false);

  /** Snapshot of active registration codes fetched from the server. */
  readonly regCodes = signal<Array<{
    code: string;
    createdAt: number;
    createdBy: string;
    expiresAt: number | null;
    maxUses: number;
    usedCount: number;
  }>>([]);

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
    // Pre-populate the registration codes list for admin users.
    if (this.isAdmin()) {
      void this._loadRegistrationCodes();
    }
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
   * Loads the current list of active registration codes from the server and
   * updates regCodes. Silently ignores errors — the UI shows an empty list.
   */
  private async _loadRegistrationCodes(): Promise<void> {
    const result = await this._authService.listRegistrationCodes();
    if (result.ok && result.codes) {
      this.regCodes.set(result.codes);
    }
  }

  /**
   * Submits a create-registration-code request using the current form state.
   * On success, updates regCodeResult and refreshes the code list.
   */
  async submitCreateRegistrationCode(): Promise<void> {
    this.regCodeResult.set(undefined);
    this.regCodeError.set(undefined);
    this.regCodeSubmitting.set(true);

    try {
      const expiresInDays = this.regCodeExpiresInDays();
      const expiresIn = expiresInDays !== null && expiresInDays > 0
        ? expiresInDays * 24 * 60 * 60 * 1000
        : undefined;

      const result = await this._authService.createRegistrationCode({
        maxUses: this.regCodeMaxUses(),
        expiresIn,
      });

      if (result.ok && result.code) {
        this.regCodeResult.set(result.code);
        await this._loadRegistrationCodes();
      } else {
        this.regCodeError.set(result.message ?? 'Failed to create code');
      }
    } finally {
      this.regCodeSubmitting.set(false);
    }
  }

  /**
   * Disables the given registration code and refreshes the list.
   */
  async disableRegistrationCode(code: string): Promise<void> {
    await this._authService.disableRegistrationCode(code);
    await this._loadRegistrationCodes();
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
