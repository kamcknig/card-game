import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { LobbyGameSummary } from 'shared/types';
import { SocketService } from '../../core/socket-service/socket.service';
import { AuthService } from '../../core/auth/auth.service';
import { lobbyGamesStore, lobbyStatusMessageStore } from '../../state/lobby-state';
import { SceneContentComponent } from '../scene-content/scene-content.component';
import { sceneStore } from '../../state/game-state';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [SceneContentComponent],
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
}
