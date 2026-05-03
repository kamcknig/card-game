import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { LobbyGameSummary } from 'shared/types';
import { SocketService } from '../../core/socket-service/socket.service';
import { authNeedsEmailStore } from '../../core/auth/auth.service';
import { activeLobbyGameIdStore, lobbyGamesStore, lobbyStatusMessageStore } from '../../state/lobby-state';
import { matchStartedStore } from '../../state/match-state';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { UiDialogComponent } from '../ui/dialog/ui-dialog.component';

/**
 * Describes the deferred create/join action that triggered the still-in-game
 * dialog. Replayed after the user chooses "Leave game" and the server confirms.
 */
type PendingIntent =
  | { kind: 'create' }
  | { kind: 'join'; gameId: string };

/**
 * Lobby scene — displays joinable games and allows creating/joining them.
 * Auth actions (logout, profile, settings) are handled by ProfileMenuComponent
 * in the banner header.
 *
 * Users without an email address attached to their account (legacy accounts
 * predating email registration) are shown a modal dialog when they attempt to
 * create or join a game. The dialog links them to `/profile` where
 * they can attach an email. The socket event is never emitted in this case —
 * the server enforces the same gate as defence in depth.
 *
 * Users who are still attached to an existing game (activeLobbyGameIdStore is
 * set) are shown a "still in game" confirmation dialog before the create / join
 * is allowed to fire. They can leave the existing game, return to it, or cancel.
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
  private readonly _router = inject(Router);

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

  // Controls visibility of the "still in another game" confirmation dialog.
  // Shown when the user clicks Create Game or Join while activeLobbyGameIdStore is set.
  readonly showStillInGameDialog = signal(false);

  // Whether the existing game has passed the lobby phase (match started).
  // Drives navigation target ("Return to game") and the leave event emitted.
  readonly stillInGameMatchStarted = signal(false);

  // The deferred create / join action captured when the dialog opened.
  // Replayed after the user confirms "Leave game".
  private _pendingIntent: PendingIntent | null = null;

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
   * required dialog instead so the user can navigate to `/profile`.
   * When the user is still attached to an existing game, the still-in-game
   * dialog intercepts the request instead of firing the socket event directly.
   */
  createGame(): void {
    if (this.needsEmail()) {
      this.showEmailRequiredDialog.set(true);
      return;
    }
    this._attempt({ kind: 'create' });
  }

  /**
   * Attempts to join one selected lobby game.
   *
   * Blocked when the user has no email address attached — shows the email-
   * required dialog instead so the user can navigate to `/profile`.
   * When the user is still attached to an existing game, the still-in-game
   * dialog intercepts the request instead of firing the socket event directly.
   */
  joinGame(gameId: string): void {
    if (this.needsEmail()) {
      this.showEmailRequiredDialog.set(true);
      return;
    }
    this._attempt({ kind: 'join', gameId });
  }

  /** Dismisses the email-required dialog. */
  dismissEmailRequiredDialog(): void {
    this.showEmailRequiredDialog.set(false);
  }

  /**
   * Either fires the create / join intent immediately, or opens the
   * still-in-game dialog when the user is already attached to a game.
   */
  private _attempt(intent: PendingIntent): void {
    const activeGameId = activeLobbyGameIdStore.get();
    if (activeGameId) {
      // Capture the pending intent and open the confirmation dialog.
      this._pendingIntent = intent;
      this.stillInGameMatchStarted.set(matchStartedStore.get());
      this.showStillInGameDialog.set(true);
      return;
    }
    this._fireIntent(intent);
  }

  /**
   * Fires the create or join socket event directly, bypassing the dialog.
   * Also clears the lobby status message so any previous error is dismissed.
   */
  private _fireIntent(intent: PendingIntent): void {
    lobbyStatusMessageStore.set(undefined);
    if (intent.kind === 'create') {
      this._socketService.emit('createLobbyGame');
    } else {
      this._socketService.emit('joinLobbyGame', intent.gameId);
    }
  }

  /**
   * "Return to game" dialog action.
   *
   * Navigates the user back to the in-progress game (/match when the match has
   * started, /configuration while still in the lobby phase) and dismisses the
   * dialog. The pending intent is discarded.
   */
  onStillInGameReturn(): void {
    this.showStillInGameDialog.set(false);
    this._pendingIntent = null;
    const target = this.stillInGameMatchStarted() ? '/match' : '/configuration';
    void this._router.navigate([target]);
  }

  /**
   * "Leave game" dialog action.
   *
   * Emits the appropriate leave event (resignMatch for an active match,
   * leaveLobbyGame for the pre-match lobby phase) then immediately replays the
   * original intent. Server-side ordering is FIFO per socket so the leave is
   * processed before the create / join arrives.
   *
   * Clears match-related state locally up front so the navigation triggered by
   * the subsequent joinedLobbyGame response is not bounced by noActiveMatchGuard.
   * Without this, the guard would still see matchStartedStore=true (until
   * kickedFromGame arrives) and redirect /configuration -> /lobby.
   */
  onStillInGameLeave(): void {
    const intent = this._pendingIntent;
    this._pendingIntent = null;
    this.showStillInGameDialog.set(false);

    const activeGameId = activeLobbyGameIdStore.get();
    if (!activeGameId || !intent) return;

    // Clear local match state up front so create/join navigation isn't blocked
    // by stale matchStartedStore/activeLobbyGameIdStore values while waiting
    // for the server's kickedFromGame echo.
    activeLobbyGameIdStore.set(undefined);
    matchStartedStore.set(false);
    lobbyStatusMessageStore.set(undefined);

    if (this.stillInGameMatchStarted()) {
      // Active match: resignMatch removes them server-side and broadcasts the
      // disconnection to the remaining players.
      this._socketService.emit('resignMatch');
    } else {
      // Lobby phase: mirrors the path taken by MatchConfigurationComponent
      // when the user navigates away before the match starts.
      this._socketService.emit('leaveLobbyGame', activeGameId);
    }

    // Replay the original intent after the leave event has been queued.
    this._fireIntent(intent);
  }

  /**
   * "Cancel" dialog action.
   *
   * Dismisses the still-in-game dialog and discards the pending intent.
   * No socket traffic is emitted.
   */
  onStillInGameCancel(): void {
    this._pendingIntent = null;
    this.showStillInGameDialog.set(false);
  }
}
