import { Component, Input, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { Player, PlayerId } from 'shared/shared-types';
import { debounceTime, Observable, Subject } from 'rxjs';
import { AsyncPipe, NgIf } from '@angular/common';
import { playerStore, selfPlayerIdStore } from 'src/app/state/player-state';
import { SocketService } from '../../core/socket-service/socket.service';

@Component({
  selector: 'app-player-name-input',
  standalone: true,
  imports: [
    AsyncPipe,
    NgIf
  ],
  styleUrls: ['./player-name-input.component.scss'],
  template: `
    <li *ngIf="$player | async as player">
      <input
        type="checkbox"
        [disabled]="playerId !== ($selfId | async)"
        [checked]="player.ready"
        (input)="onReadyChange($any($event.target).checked)"
      />

      @if (playerId === ($selfId | async)) {
        <input
          class="player-name editable"
          type="text"
          [value]="player.name"
          (input)="onNameChange($any($event.target).value)"
        />
      } @else {
        <span class="player-name readonly">{{ player.name }}</span>
      }

      @if (!player.connected) {
        <span>⚠️</span>
      }
    </li>
  `
})
export class PlayerComponent implements OnInit {
  @Input() playerId!: PlayerId;
  $player!: Observable<Player | undefined>;

  $selfId!: Observable<PlayerId | undefined>;

  private nameInput$ = new Subject<string>();

  constructor(
    private _nanoStores: NanostoresService,
    private _socketService: SocketService
  ) {}

  ngOnInit(): void {
    this.$player = this._nanoStores.useStore(playerStore(this.playerId));
    this.$selfId = this._nanoStores.useStore(selfPlayerIdStore);

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
