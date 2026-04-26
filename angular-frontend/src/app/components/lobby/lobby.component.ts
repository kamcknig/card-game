import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LobbyGameSummary } from 'shared/types';
import { SocketService } from '../../core/socket-service/socket.service';
import { authNeedsEmailStore } from '../../core/auth/auth.service';
import { lobbyGamesStore, lobbyStatusMessageStore } from '../../state/lobby-state';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { UiDialogComponent } from '../ui/dialog/ui-dialog.component';

/**
 * Lobby scene — displays joinable games and allows creating/joining them.
 * Auth actions (logout, profile, settings) are handled by ProfileMenuComponent
 * in the banner header.
 *
 * Users without an email address attached to their account (legacy accounts
 * predating email registration) are shown a modal dialog when they attempt to
 * create or join a game. The dialog links them to `/profile/security` where
 * they can attach an email. The socket event is never emitted in this case —
 * the server enforces the same gate as defence in depth.
 */
@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [SceneContentComponent, UiDialogComponent, RouterLink],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyComponent implements OnInit {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);

  // Streams the currently visible joinable games for the lobby list.
  private readonly _games = toSignal(this._nanoStores.useStore(lobbyGamesStore));
  readonly games = computed<readonly LobbyGameSummary[]>(() => this._games() ?? []);
  // Streams the latest lobby status/error message.
  statusMessage = toSignal(this._nanoStores.useStore(lobbyStatusMessageStore));

  // Tracks whether the authenticated user still needs to attach an email.
  // true for legacy accounts predating email registration; false once email is set.
  readonly needsEmail = toSignal(this._nanoStores.useStore(authNeedsEmailStore), {
    initialValue: authNeedsEmailStore.get(),
  });

  // Controls visibility of the "email required" modal dialog.
  readonly showEmailRequiredDialog = signal(false);

  // Current left-nav selection (single-tab for now).
  readonly selectedNav: 'games' = 'games';

  ngOnInit(): void {
    // Always request a fresh snapshot when entering lobby scene.
    this._socketService.emit('requestLobbySnapshot');
  }

  /**
   * Requests server-side creation of a new lobby game.
   *
   * Blocked when the user has no email address attached — shows the email-
   * required dialog instead so the user can navigate to `/profile/security`.
   */
  createGame(): void {
    if (this.needsEmail()) {
      this.showEmailRequiredDialog.set(true);
      return;
    }
    lobbyStatusMessageStore.set(undefined);
    this._socketService.emit('createLobbyGame');
  }

  /**
   * Attempts to join one selected lobby game.
   *
   * Blocked when the user has no email address attached — shows the email-
   * required dialog instead so the user can navigate to `/profile/security`.
   */
  joinGame(gameId: string): void {
    if (this.needsEmail()) {
      this.showEmailRequiredDialog.set(true);
      return;
    }
    lobbyStatusMessageStore.set(undefined);
    this._socketService.emit('joinLobbyGame', gameId);
  }

  /** Dismisses the email-required dialog. */
  dismissEmailRequiredDialog(): void {
    this.showEmailRequiredDialog.set(false);
  }
}
