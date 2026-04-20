import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { Eye, EyeOff, LucideAngularModule } from 'lucide-angular';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { NewPasswordFieldsComponent } from '../ui/new-password-fields/new-password-fields.component';
import { UiDialogComponent } from '../ui/dialog/ui-dialog.component';
import { AuthService, pendingRegistrationCodeStore } from '../../core/auth/auth.service';
import { sceneStore } from '../../state/game-state';

/**
 * Login scene component that gates access to the lobby.
 *
 * Displays a username/password form with a mode toggle between Sign In and
 * Register. Register mode asks for an additional registration code issued by
 * an existing user (or via CLI) and calls POST /auth/register. On successful
 * registration the component flips back to Sign In mode with a success
 * message — server does not automatically create a session.
 *
 * Sign In uses the 'user' provider. The legacy 'password' provider is kept
 * available on the server for operators who want to run the shared-password
 * flow, but this UI targets the per-user provider.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [SceneContentComponent, FormsModule, NewPasswordFieldsComponent, LucideAngularModule, UiDialogComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly _authService = inject(AuthService);

  // Lucide icon references exposed to the template for the sign-in password
  // visibility toggle.
  readonly EyeIcon = Eye;
  readonly EyeOffIcon = EyeOff;

  /** Current form mode — 'signin' or 'register'. */
  readonly mode = signal<'signin' | 'register'>('signin');

  readonly username = signal('');
  readonly password = signal('');
  /** Confirmation of {@link password} — only used when mode() === 'register'. */
  readonly confirmPassword = signal('');
  /** Registration code — only used when mode() === 'register'. */
  readonly registrationCode = signal('');
  readonly errorMessage = signal<string | undefined>(undefined);
  readonly successMessage = signal<string | undefined>(undefined);
  readonly isSubmitting = signal(false);
  /** Controls whether the sign-in password field renders as plain text. */
  readonly showPassword = signal(false);
  /** Username availability error shown inline below the username field in register mode. */
  readonly usernameError = signal<string | undefined>(undefined);
  /** True while the invalid-code modal is visible after a failed deep-link code validation. */
  readonly showInvalidCodeModal = signal(false);

  /** Tracks whether the registration code was pre-filled from a URL deep link. */
  private _codeFromDeepLink = false;

  /**
   * Reference to the shared primary/confirm password component rendered in
   * register mode. Used to read its `mismatch` signal when gating the submit
   * button — undefined in signin mode (component is not rendered).
   */
  readonly newPasswordFields = viewChild(NewPasswordFieldsComponent);

  constructor() {
    // Pre-fill registration code from URL deep-link if one was staged on startup.
    // We set mode() directly (not via setMode()) to avoid clearing registrationCode,
    // then set registrationCode separately. The store is cleared after reading so
    // subsequent LoginComponent instantiations do not re-apply a stale value.
    const pending = pendingRegistrationCodeStore.get();
    if (pending) {
      this.mode.set('register');
      this.registrationCode.set(pending);
      pendingRegistrationCodeStore.set(undefined);
      // Flag so ngOnInit can validate the code asynchronously.
      this._codeFromDeepLink = true;
    }

    // Debounced username availability check — fires only in register mode.
    toObservable(this.username)
      .pipe(
        // Clear any previous error immediately so stale text doesn't linger while typing.
        tap(() => this.usernameError.set(undefined)),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(async (username) => {
          if (this.mode() !== 'register' || !username.trim()) {
            return undefined;
          }
          const available = await this._authService.checkUsernameAvailability(username.trim());
          return available ? undefined : 'Username is already taken';
        }),
        takeUntilDestroyed(),
      )
      .subscribe((error) => this.usernameError.set(error));
  }

  /**
   * Validates the deep-link registration code, if any, after the component
   * initialises. Shows the invalid-code modal and clears the code field when
   * the server reports the code is not redeemable.
   */
  ngOnInit(): void {
    if (!this._codeFromDeepLink) {
      return;
    }

    const code = this.registrationCode();
    if (!code) {
      return;
    }

    void this._authService.validateRegistrationCode(code).then(result => {
      if (!result.valid) {
        this.registrationCode.set('');
        this.showInvalidCodeModal.set(true);
      }
    });
  }

  /** Dismisses the invalid-code modal; the register form remains visible. */
  dismissInvalidCodeModal(): void {
    this.showInvalidCodeModal.set(false);
  }

  /** Toggles the password visibility state. */
  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  /**
   * Switches between sign-in and register modes, clearing every field and
   * transient message so one form's state does not bleed into the other.
   *
   * Callers that want to preserve a field across the mode switch (e.g. the
   * post-registration flow that prefills the just-registered username into
   * sign-in) should write to that field AFTER calling setMode.
   */
  setMode(next: 'signin' | 'register'): void {
    this.mode.set(next);
    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);
    this.usernameError.set(undefined);
    this.username.set('');
    this.password.set('');
    this.confirmPassword.set('');
    this.registrationCode.set('');
  }

  /**
   * Handles form submission for the currently selected mode.
   *
   * Sign In: validates credentials against the 'user' provider and moves to
   * the lobby scene on success.
   * Register: calls POST /auth/register, then flips back to Sign In with a
   * success toast so the user can immediately log in with the new account.
   */
  async onSubmit(): Promise<void> {
    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);

    const username = this.username().trim();
    const password = this.password();

    if (!username || !password) {
      this.errorMessage.set('Username and password are required');
      return;
    }

    this.isSubmitting.set(true);

    try {
      if (this.mode() === 'signin') {
        // Use the user-account provider for per-user credential validation.
        const result = await this._authService.login(
          { username, password },
          'user',
        );
        if (result.ok) {
          sceneStore.set('lobby');
        } else {
          // Surface server messages verbatim so rate-limit / lockout text
          // reaches the user (e.g. 'Too many attempts', 'Account temporarily
          // locked').
          this.errorMessage.set(result.message ?? 'Username/password does not match');
        }
      } else {
        // Belt-and-braces: the submit button is disabled when passwords
        // differ, but re-check here in case the form was submitted via Enter
        // before the confirm field lost focus.
        if (this.password() !== this.confirmPassword()) {
          this.errorMessage.set('Passwords do not match');
          return;
        }

        const code = this.registrationCode().trim();
        if (!code) {
          this.errorMessage.set('Registration code is required');
          return;
        }

        const result = await this._authService.register(username, password, code);
        if (result.ok) {
          this.successMessage.set('Account created — please sign in.');
          this.setMode('signin');
          // Keep the username prefilled so the new user only has to type the
          // password they just entered.
          this.username.set(username);
        } else {
          this.errorMessage.set(result.message ?? 'Registration failed');
        }
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
