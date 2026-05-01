import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { Player, PlayerId } from 'shared/types';
import { filter, switchMap } from 'rxjs';

import { playerStore, selfPlayerIdStore } from '../../../state/player-state';
import { SocketService } from '../../../core/socket-service/socket.service';
import { gameOwnerIdStore } from '../../../state/game-state';
import { activeLobbyGameIdStore } from '../../../state/lobby-state';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-player-name-input',
  standalone: true,
  imports: [],
  styleUrls: ['./player-name-input.component.scss'],
  templateUrl: './player-name-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerComponent {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);

  playerId = input<PlayerId>(0);

  // Active player row model.
  readonly player = toSignal<Player | undefined>(
    toObservable(this.playerId).pipe(
      filter((playerId): playerId is PlayerId => playerId > 0),
      switchMap((playerId) => this._nanoStores.useStore(playerStore(playerId)))
    ),
    { initialValue: undefined }
  );
  readonly selfId = toSignal(this._nanoStores.useStore(selfPlayerIdStore));
  private readonly _gameOwnerId = toSignal(this._nanoStores.useStore(gameOwnerIdStore));
  readonly isOwner = computed(() => this._gameOwnerId() === this.playerId());
  // True when the viewing client is the game owner and this row is a different player.
  readonly canModeratePlayer = computed(() => {
    const ownerId = this._gameOwnerId();
    const selfId = this.selfId();
    const rowPlayerId = this.playerId();
    return ownerId === selfId && rowPlayerId !== selfId;
  });

  onReadyChange(ready: boolean) {
    this._socketService.emit('playerReady', this.playerId(), ready);
  }

  // Kicks this player from the current lobby game when owner moderation is available.
  onKickPlayer() {
    const gameId = activeLobbyGameIdStore.get();
    if (!gameId) return;
    this._socketService.emit('kickLobbyPlayer', gameId, this.playerId());
  }

  // Bans this player from the current lobby game when owner moderation is available.
  onBanPlayer() {
    const gameId = activeLobbyGameIdStore.get();
    if (!gameId) return;
    this._socketService.emit('banLobbyPlayer', gameId, this.playerId());
  }
}
