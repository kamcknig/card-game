import { Component } from '@angular/core';
import { PlayerID } from 'shared/shared-types';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore, selfPlayerIdStore } from '../state/player-state';
import { combineLatest, map, Observable } from 'rxjs';
import { AsyncPipe, NgClass, NgOptimizedImage } from '@angular/common';
import { PlayerComponent } from './player-name-input/player-name-input.component';
import { expansionListStore } from '../state/expansion-list-state';
import { matchConfigurationStore } from '../state/match-state';
import { SocketService } from '../core/socket-service/socket.service';
import { gameOwnerIdStore } from '../state/game-state';

@Component({
  selector: 'app-match-configuration',
  imports: [
    AsyncPipe,
    PlayerComponent,
    NgOptimizedImage,
    NgClass
  ],
  templateUrl: './match-configuration.component.html',
  styleUrl: './match-configuration.component.scss'
})
export class MatchConfigurationComponent {
  public $playerIds!: Observable<readonly PlayerID[]>;
  public $expansionList!: Observable<readonly any[]>;
  public $selectedExpansions!: Observable<string[]>;
  public isGameOwner: boolean = false;

  constructor(
    private _nanoStoreService: NanostoresService,
    private _socketService: SocketService,
  ) {
    this.$playerIds = this._nanoStoreService.useStore(playerIdStore);
    this.$expansionList = this._nanoStoreService.useStore(expansionListStore);
    this.$selectedExpansions = this._nanoStoreService.useStore(matchConfigurationStore).pipe(
      map(config => config?.expansions ?? []));
    combineLatest([
      this._nanoStoreService.useStore(gameOwnerIdStore),
      this._nanoStoreService.useStore(selfPlayerIdStore)
    ]).subscribe(([ownerId, playerId]) => this.isGameOwner = playerId === ownerId);
  }

  onToggleExpansion(expansion: string) {
    const currentExpansions = matchConfigurationStore.get()?.expansions ?? [];
    const currentIdx = currentExpansions?.indexOf(expansion);

    if (currentIdx === undefined || currentIdx === -1) {
      currentExpansions.push(expansion);
    } else {
      currentExpansions.splice(currentIdx, 1);
    }

    this._socketService.emit('matchConfigurationUpdated', { expansions: currentExpansions ?? []});
  }
}
