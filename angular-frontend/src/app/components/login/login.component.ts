import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Eye, EyeOff, LucideAngularModule } from 'lucide-angular';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { NewPasswordFieldsComponent } from '../ui/new-password-fields/new-password-fields.component';
import { AuthService } from '../../core/auth/auth.service';

/** Intentionally permissive — the server performs the authoritative check. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors the server-side USERNAME_REGEX so format errors surface before the network round-trip. */
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,32}$/;

/**
 * Login scene component that gates access to the lobby.
 *
 * Displays a username/password form with a mode toggle between Sign In and
 * Register. Register mode requires an email address and calls POST /auth/register.
 * On successful registration the component flips back to Sign In mode with a
 * success message — server does not automatically create a session.
 *
 * Sign In uses the 'user' provider. The legacy 'password' provider is kept
 * available on the server for operators who want to run the shared-password
 * flow, but this UI targets the per-user provider.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [SceneContentComponent, FormsModule, NewPasswordFieldsComponent, LucideAngularModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);

  // Lucide icon references exposed to the template for the sign-in password
  // visibility toggle.
  readonly EyeIcon = Eye;
  readonly EyeOffIcon = EyeOff;

  /** Current form mode — 'signin' or 'register'. */
  readonly mode = signal<'signin' | 'register'>('signin');

  readonly username = signal('');
  /** Email address — only used when mode() === 'register'. */
  readonly email = signal('');
  readonly password = signal('');
  /** Confirmation of {@link password} — only used when mode() === 'register'. */
  readonly confirmPassword = signal('');
  readonly errorMessage = signal<string | undefined>(undefined);
  readonly successMessage = signal<string | undefined>(undefined);
  readonly isSubmitting = signal(false);
  /** Controls whether the sign-in password field renders as plain text. */
  readonly showPassword = signal(false);

  /**
   * Resend-confirmation panel state. The panel is collapsed by default and
   * expands when the user clicks "Resend confirmation email" so it does not
   * compete visually with the primary login form.
   *
   * `prefilledEmail` is populated immediately after a successful registration
   * so the user can click Resend without retyping the email they just used.
   * It is cleared on mode switches and on a successful resend.
   */
  readonly resendOpen = signal(false);
  readonly resendEmail = signal('');
  readonly resendIsSubmitting = signal(false);
  readonly resendMessage = signal<string | undefined>(undefined);
  readonly resendError = signal<string | undefined>(undefined);
  /**
   * Per-field availability status for the register form.
   * `checking` is true while the server request is in flight.
   * `error` is set when the value is already taken.
   */
  readonly emailStatus = signal<{ checking: boolean; error?: string }>({ checking: false });
  readonly usernameStatus = signal<{ checking: boolean; error?: string }>({ checking: false });

  /**
   * Reference to the shared primary/confirm password component rendered in
   * register mode. Used to read its `mismatch` signal when gating the submit
   * button — undefined in signin mode (component is not rendered).
   */
  readonly newPasswordFields = viewChild(NewPasswordFieldsComponent);

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
    // Reset per-field availability status so stale errors don't carry across modes.
    this.usernameStatus.set({ checking: false });
    this.emailStatus.set({ checking: false });
    this.username.set('');
    this.email.set('');
    this.password.set('');
    this.confirmPassword.set('');
    // Collapse and clear the resend panel so its state does not bleed
    // across mode switches. The prefilled email is intentionally dropped
    // here because the user is starting a fresh form.
    this.resendOpen.set(false);
    this.resendEmail.set('');
    this.resendMessage.set(undefined);
    this.resendError.set(undefined);
  }

  /**
   * Toggles the resend-confirmation panel below the login form.
   *
   * Opening the panel clears any previous transient feedback so a stale
   * success/error message from an earlier attempt is not visible when the
   * user starts a new resend cycle. Closing the panel preserves the email
   * input so reopening continues from where the user left off.
   */
  toggleResend(): void {
    const willOpen = !this.resendOpen();
    this.resendOpen.set(willOpen);
    if (willOpen) {
      this.resendMessage.set(undefined);
      this.resendError.set(undefined);
    }
  }

  /**
   * Fires when the resend email input loses focus.
   *
   * Validates the address format with the same EMAIL_REGEX used by the
   * register form so the user gets a format error before clicking Send.
   * No-ops when the field is empty so an untouched blur (e.g. tabbing
   * past) does not flag a phantom error. Does NOT check availability —
   * the resend endpoint is intentionally not an enumeration oracle, so
   * we never call /auth/check-email here.
   */
  onResendEmailBlur(): void {
    const email = this.resendEmail().trim();
    if (!email) {
      this.resendError.set(undefined);
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      this.resendError.set('Enter a valid email address');
      return;
    }
    this.resendError.set(undefined);
  }

  /**
   * Updates the resend email signal and clears any standing error message.
   *
   * Routed through a method (instead of an inline signal.set) so a blur-
   * generated 'Enter a valid email address' error does not persist while
   * the user types a fix — the moment they edit the field, stale feedback
   * is cleared. Submission re-validates so an invalid value never reaches
   * the server.
   */
  onResendEmailInput(value: string): void {
    this.resendEmail.set(value);
    if (this.resendError()) {
      this.resendError.set(undefined);
    }
  }

  /**
   * Submits the resend-confirmation request to the server.
   *
   * The server intentionally responds with the same generic success
   * regardless of whether the email exists, is already confirmed, or
   * triggered a Supabase error — this UI mirrors that with a single neutral
   * message. The only error message surfaced verbatim is the per-IP rate-
   * limit response (HTTP 429) so the user knows to wait before retrying.
   */
  async onResend(): Promise<void> {
    this.resendError.set(undefined);
    this.resendMessage.set(undefined);

    const email = this.resendEmail().trim();
    if (!email) {
      this.resendError.set('Email is required');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      this.resendError.set('Enter a valid email address');
      return;
    }

    this.resendIsSubmitting.set(true);
    try {
      const result = await this._authService.resendConfirmation(email);
      if (result.ok) {
        // Neutral message: do not reveal whether the email exists or was
        // already confirmed — preserves the server's no-enumeration guarantee.
        this.resendMessage.set(
          'If your email is registered and unconfirmed, a new link is on its way. Already confirmed? Just sign in.',
        );
      } else {
        // Surface server messages verbatim so 'Too many attempts' reaches
        // the user. Other shapes fall back to a neutral failure copy.
        this.resendError.set(result.message ?? 'Could not resend confirmation email');
      }
    } finally {
      this.resendIsSubmitting.set(false);
    }
  }

  /**
   * Fires when the email input loses focus in register mode.
   *
   * Checks email availability against the server and updates `emailStatus`
   * with the result. No-ops when in sign-in mode or when the field is empty.
   */
  async onEmailBlur(): Promise<void> {
    if (this.mode() !== 'register') return;
    const email = this.email().trim();
    if (!email) {
      this.emailStatus.set({ checking: false });
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      this.emailStatus.set({ checking: false, error: 'Enter a valid email address' });
      return;
    }
    this.emailStatus.set({ checking: true });
    const available = await this._authService.checkEmailAvailability(email);
    this.emailStatus.set({
      checking: false,
      error: available ? undefined : 'Email is already registered',
    });
  }

  /**
   * Fires when the username input loses focus in register mode.
   *
   * Validates the username format against USERNAME_REGEX first, then checks
   * availability against the server. No-ops when in sign-in mode or when
   * the field is empty.
   */
  async onUsernameBlur(): Promise<void> {
    if (this.mode() !== 'register') return;
    const username = this.username().trim();
    if (!username) {
      this.usernameStatus.set({ checking: false });
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      this.usernameStatus.set({ checking: false, error: 'Username must be 3–32 characters, letters, numbers, or underscores only' });
      return;
    }
    this.usernameStatus.set({ checking: true });
    const available = await this._authService.checkUsernameAvailability(username);
    this.usernameStatus.set({
      checking: false,
      error: available ? undefined : 'Username is already taken',
    });
  }

  /**
   * Updates the username signal and clears any standing format/availability
   * error so stale feedback does not persist while the user types a fix.
   */
  onUsernameInput(value: string): void {
    this.username.set(value);
    if (this.usernameStatus().error) {
      this.usernameStatus.set({ checking: false });
    }
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
          void this._router.navigate(['/lobby']);
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

        const registerEmail = this.email().trim();
        const result = await this._authService.register(username, registerEmail, password);
        if (result.ok) {
          // setMode clears all fields and messages; set the success toast and
          // restore the username AFTER calling setMode so they survive the clear.
          this.setMode('signin');
          this.successMessage.set(
            'Account created — check your email to confirm. You can resend the confirmation if it does not arrive.',
          );
          // Keep the username prefilled so the new user only has to type the
          // password they just entered.
          this.username.set(username);
          // Prefill the resend-confirmation email with the address just used,
          // so the user can click Resend without retyping it. The panel stays
          // collapsed until they click the toggle — the success banner
          // already tells them where to confirm and where to resend if needed.
          this.resendEmail.set(registerEmail);
        } else {
          this.errorMessage.set(result.message ?? 'Registration failed');
        }
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
