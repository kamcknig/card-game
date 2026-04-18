import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LobbyGameSummary } from 'shared/types';
import { SocketService } from '../../core/socket-service/socket.service';
import { AuthService } from '../../core/auth/auth.service';
import { lobbyGamesStore, lobbyStatusMessageStore } from '../../state/lobby-state';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { sceneStore } from '../../state/game-state';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [SceneContentComponent, FormsModule],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyComponent implements OnInit {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);
  private readonly _authService = inject(AuthService);

  // Streams the currently visible joinable games for the lobby list.
  private readonly _games = toSignal(this._nanoStores.useStore(lobbyGamesStore));
  readonly games = computed<readonly LobbyGameSummary[]>(() => this._games() ?? []);
  // Streams the latest lobby status/error message.
  statusMessage = toSignal(this._nanoStores.useStore(lobbyStatusMessageStore));

  // Current left-nav selection (single-tab for now).
  readonly selectedNav: 'games' = 'games';

  // Controls visibility of the compact change-password form embedded in the
  // lobby header. A full dialog component can replace this later without
  // changing AuthService.changePassword().
  readonly changePasswordOpen = signal(false);
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly changePasswordError = signal<string | undefined>(undefined);
  readonly changePasswordSuccess = signal<string | undefined>(undefined);
  readonly changePasswordSubmitting = signal(false);

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
   * Toggles the change-password panel and clears transient state when closed.
   */
  toggleChangePassword(): void {
    this.changePasswordOpen.update(v => !v);
    if (!this.changePasswordOpen()) {
      this.currentPassword.set('');
      this.newPassword.set('');
      this.changePasswordError.set(undefined);
      this.changePasswordSuccess.set(undefined);
    }
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
      } else {
        this.changePasswordError.set(result.message ?? 'Password change failed');
      }
    } finally {
      this.changePasswordSubmitting.set(false);
    }
  }
}
