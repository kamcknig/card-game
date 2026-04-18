import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { AuthService } from '../../core/auth/auth.service';
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
  imports: [SceneContentComponent, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly _authService = inject(AuthService);

  /** Current form mode — 'signin' or 'register'. */
  readonly mode = signal<'signin' | 'register'>('signin');

  readonly username = signal('');
  readonly password = signal('');
  /** Registration code — only used when mode() === 'register'. */
  readonly registrationCode = signal('');
  readonly errorMessage = signal<string | undefined>(undefined);
  readonly successMessage = signal<string | undefined>(undefined);
  readonly isSubmitting = signal(false);
  /** Controls whether the password field renders as plain text. */
  readonly showPassword = signal(false);

  /** Toggles the password visibility state. */
  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  /**
   * Switches between sign-in and register modes, clearing transient state so
   * messages from one mode do not bleed into the other.
   */
  setMode(next: 'signin' | 'register'): void {
    this.mode.set(next);
    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);
    this.password.set('');
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
