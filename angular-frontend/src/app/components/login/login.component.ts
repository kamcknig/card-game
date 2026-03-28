import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { AuthService } from '../../core/auth/auth.service';
import { sceneStore } from '../../state/game-state';

/**
 * Login scene component that gates access to the lobby.
 *
 * Displays a centered username/password form. On successful login,
 * transitions to the lobby scene. Shows an error message on failure.
 * Uses the 'password' auth provider via AuthService.
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

  readonly username = signal('');
  readonly password = signal('');
  readonly errorMessage = signal<string | undefined>(undefined);
  readonly isSubmitting = signal(false);
  /** Controls whether the password field renders as plain text. */
  readonly showPassword = signal(false);

  /** Toggles the password visibility state. */
  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  /**
   * Handles login form submission. Validates credentials via the server
   * and transitions to lobby on success. Shows an error message on failure.
   */
  async onSubmit(): Promise<void> {
    this.errorMessage.set(undefined);

    if (!this.username().trim() || !this.password()) {
      this.errorMessage.set('Username/password does not match');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const result = await this._authService.login(
        { username: this.username().trim(), password: this.password() },
        'password',
      );
      if (result.ok) {
        sceneStore.set('lobby');
      } else {
        this.errorMessage.set('Username/password does not match');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
