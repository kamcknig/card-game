import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LobbyGameSummary } from 'shared/types';
import { SocketService } from '../../core/socket-service/socket.service';
import { AuthService } from '../../core/auth/auth.service';
import { lobbyGamesStore, lobbyStatusMessageStore } from '../../state/lobby-state';
import { LucideAngularModule, X } from 'lucide-angular';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { UiDialogComponent } from '../ui/dialog/ui-dialog.component';
import { NewPasswordFieldsComponent } from '../ui/new-password-fields/new-password-fields.component';
import { sceneStore } from '../../state/game-state';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [SceneContentComponent, FormsModule, UiDialogComponent, NewPasswordFieldsComponent, LucideAngularModule],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyComponent implements OnInit {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);
  private readonly _authService = inject(AuthService);

  // Lucide icon reference exposed to the template for the change-password
  // dialog's close (×) button.
  readonly XIcon = X;

  // Streams the currently visible joinable games for the lobby list.
  private readonly _games = toSignal(this._nanoStores.useStore(lobbyGamesStore));
  readonly games = computed<readonly LobbyGameSummary[]>(() => this._games() ?? []);
  // Streams the latest lobby status/error message.
  statusMessage = toSignal(this._nanoStores.useStore(lobbyStatusMessageStore));

  // Current left-nav selection (single-tab for now).
  readonly selectedNav: 'games' = 'games';

  // Controls visibility of the change-password dialog launched from the lobby
  // header. Rendering goes through UiDialogComponent so the form overlays the
  // lobby with a backdrop rather than pushing layout.
  readonly changePasswordOpen = signal(false);
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  /** Confirmation of {@link newPassword}; must match before submit is allowed. */
  readonly confirmNewPassword = signal('');
  readonly changePasswordError = signal<string | undefined>(undefined);
  readonly changePasswordSuccess = signal<string | undefined>(undefined);
  readonly changePasswordSubmitting = signal(false);

  /**
   * Reference to the shared primary/confirm password component rendered
   * inside the change-password dialog. Used to read its `mismatch` signal
   * when gating the submit button — undefined while the dialog is closed.
   */
  readonly newPasswordFields = viewChild(NewPasswordFieldsComponent);

  ngOnInit(): void {
    // Always request a fresh snapshot when entering lobby scene.
    this._socketService.emit('requestLobbySnapshot');
  }

  // Requests server-side creation of a new lobby game.
  createGame(): void {
    lobbyStatusMessageStore.set(undefined);
    this._socketService.emit('createLobbyGame');
  }

  // Attempts to join one selected lobby game.
  joinGame(gameId: string): void {
    lobbyStatusMessageStore.set(undefined);
    this._socketService.emit('joinLobbyGame', gameId);
  }

  /**
   * Logs out the current user: invalidates the server session, disconnects
   * the socket, clears local auth state, and returns to the login scene.
   */
  async logout(): Promise<void> {
    await this._authService.logout();
    this._socketService.disconnect();
    sceneStore.set('login');
  }

  /**
   * Opens the change-password dialog with a fresh, empty form. Any residual
   * values from a prior open are cleared so the dialog never appears with
   * stale state (e.g. a lingering success toast).
   */
  openChangePassword(): void {
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmNewPassword.set('');
    this.changePasswordError.set(undefined);
    this.changePasswordSuccess.set(undefined);
    this.changePasswordOpen.set(true);
  }

  /**
   * Closes the change-password dialog and clears transient state so the next
   * open starts clean. Invoked from the dialog's backdrop click, cancel
   * button, and explicit close control.
   */
  closeChangePassword(): void {
    this.changePasswordOpen.set(false);
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmNewPassword.set('');
    this.changePasswordError.set(undefined);
    this.changePasswordSuccess.set(undefined);
  }

  /**
   * Submits the password change request.
   *
   * On success the server revokes every sibling session for this user while
   * leaving the caller's own session alive. We simply show a success message
   * and clear the form — AuthService.changePassword handles the HTTP details.
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

    // Belt-and-braces: the submit button is disabled when the confirm field
    // is empty or does not match, but re-check here in case the form is
    // submitted via Enter before the confirm input loses focus.
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
