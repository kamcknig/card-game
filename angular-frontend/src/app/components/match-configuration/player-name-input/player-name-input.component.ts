import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { Player, PlayerId } from 'shared/shared-types';
import { debounceTime, map, Observable, Subject } from 'rxjs';
import { AsyncPipe, NgIf, NgStyle } from '@angular/common';
import { playerStore } from '../../../state/player-state';
import { SocketService } from '../../../core/socket-service/socket.service';
import { selfPlayerIdStore } from '../../../state/match-state';
import { gameOwnerIdStore } from '../../../state/game-state';

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
}
