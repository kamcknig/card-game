import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { NanostoresService } from '@nanostores/angular';
import { Observable } from 'rxjs';
import { LobbyGameSummary } from 'shared/types';
import { SocketService } from '../../core/socket-service/socket.service';
import { lobbyGamesStore, lobbyStatusMessageStore } from '../../state/lobby-state';
import { SceneContentComponent } from '../scene-content/scene-content.component';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [AsyncPipe, SceneContentComponent],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyComponent implements OnInit {
  // Streams the currently visible joinable games for the lobby list.
  games$: Observable<readonly LobbyGameSummary[]>;
  // Streams the latest lobby status/error message.
  statusMessage$: Observable<string | undefined>;

  // Current left-nav selection (single-tab for now).
  readonly selectedNav: 'games' = 'games';

  constructor(
    private readonly _nanoStores: NanostoresService,
    private readonly _socketService: SocketService,
  ) {
    this.games$ = this._nanoStores.useStore(lobbyGamesStore);
    this.statusMessage$ = this._nanoStores.useStore(lobbyStatusMessageStore);
  }

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
}
