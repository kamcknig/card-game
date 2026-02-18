import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { Player, PlayerId } from 'shared/types';
import { combineLatest, debounceTime, map, Observable, Subject } from 'rxjs';
import { AsyncPipe, NgIf, NgStyle } from '@angular/common';
import { playerStore, selfPlayerIdStore } from '../../../state/player-state';
import { SocketService } from '../../../core/socket-service/socket.service';
import { gameOwnerIdStore } from '../../../state/game-state';
import { activeLobbyGameIdStore } from '../../../state/lobby-state';

@Component({
  selector: 'app-player-name-input',
  standalone: true,
  imports: [
    AsyncPipe,
    NgIf,
    NgStyle
  ],
  styleUrls: ['./player-name-input.component.scss'],
  templateUrl: './player-name-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerComponent implements OnInit {
  @Input() playerId!: PlayerId;

  $player!: Observable<Player | undefined>;
  $selfId!: Observable<PlayerId | undefined>;
  $isOwner!: Observable<boolean | undefined>;
  // True when the viewing client is the game owner and this row is a different player.
  $canModeratePlayer!: Observable<boolean>;

  private nameInput$ = new Subject<string>();

  constructor(
    private _nanoStores: NanostoresService,
    private _socketService: SocketService
  ) {
  }

  ngOnInit(): void {
    this.$player = this._nanoStores.useStore(playerStore(this.playerId));
    this.$selfId = this._nanoStores.useStore(selfPlayerIdStore);
    this.$isOwner = this._nanoStores.useStore(gameOwnerIdStore)
      .pipe(map((ownerId) => ownerId === this.playerId));
    this.$canModeratePlayer = combineLatest([
      this._nanoStores.useStore(gameOwnerIdStore),
      this._nanoStores.useStore(selfPlayerIdStore),
    ]).pipe(map(([ownerId, selfId]) => ownerId === selfId && this.playerId !== selfId));

    this.nameInput$
      .pipe(debounceTime(300)) // 300ms debounce
      .subscribe(newName => {
        const store = playerStore(this.playerId);
        const current = store.get();
        if (current) {
          this._socketService.emit('updatePlayerName', this.playerId, newName);
          store.set({ ...current, name: newName });
        }
      });
  }

  onNameChange(newName: string) {
    this.nameInput$.next(newName);
  }

  onReadyChange(ready: any) {
    this._socketService.emit('playerReady', this.playerId, ready);
  }

  // Kicks this player from the current lobby game when owner moderation is available.
  onKickPlayer() {
    const gameId = activeLobbyGameIdStore.get();
    if (!gameId) return;
    this._socketService.emit('kickLobbyPlayer', gameId, this.playerId);
  }

  // Bans this player from the current lobby game when owner moderation is available.
  onBanPlayer() {
    const gameId = activeLobbyGameIdStore.get();
    if (!gameId) return;
    this._socketService.emit('banLobbyPlayer', gameId, this.playerId);
  }
}
