import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardKey, ExpansionListElement, MatchConfiguration, PlayerId } from 'shared/shared-types';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore } from '../../state/player-state';
import { combineLatest, map, Observable } from 'rxjs';
import { AsyncPipe, NgClass, NgOptimizedImage } from '@angular/common';
import { expansionListStore } from '../../state/expansion-list-state';
import { matchConfigurationStore, selfPlayerIdStore } from '../../state/match-state';
import { SocketService } from '../../core/socket-service/socket.service';
import { gameOwnerIdStore } from '../../state/game-state';
import { PlayerComponent } from './player-name-input/player-name-input.component';

@Component({
  selector: 'app-match-configuration',
  imports: [
    AsyncPipe,
    NgOptimizedImage,
    NgClass,
    PlayerComponent
  ],
  templateUrl: './match-configuration.component.html',
  styleUrl: './match-configuration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchConfigurationComponent {
  public playerIds$!: Observable<readonly PlayerId[]>;
  public expansionList$!: Observable<readonly ExpansionListElement[]>;
  public matchExpansions$!: Observable<readonly string[]>;
  public isGameOwner: boolean = false;
  public preSelectedKingdoms: { name: string; expansion: string; cardKey: CardKey }[];

  constructor(
    private _nanoStoreService: NanostoresService,
    private _socketService: SocketService,
  ) {
    this.playerIds$ = this._nanoStoreService.useStore(playerIdStore);
    this.expansionList$ = this._nanoStoreService.useStore(expansionListStore);
    this.matchExpansions$ = this._nanoStoreService.useStore(matchConfigurationStore)
      .pipe(
        map(config => config?.expansions?.map(e => e.name)),
        map(expansions => expansions ?? [])
      );
    combineLatest([
      this._nanoStoreService.useStore(gameOwnerIdStore),
      this._nanoStoreService.useStore(selfPlayerIdStore)
    ]).subscribe(([ownerId, playerId]) => this.isGameOwner = playerId === ownerId);

    this.preSelectedKingdoms = new Array(10).fill(null);
  }

  onToggleExpansion(expansion: ExpansionListElement) {
    const currentConfig = matchConfigurationStore.get();
    const currentExpansions = currentConfig?.expansions ?? [];
    const currentIdx = currentExpansions?.findIndex(e => e.name === expansion.name);

    if (currentIdx === undefined || currentIdx === -1) {
      currentExpansions.push(expansion);
    }
    else {
      currentExpansions.splice(currentIdx, 1);
    }

    this._socketService.emit('matchConfigurationUpdated', {
      ...currentConfig as MatchConfiguration,
      expansions: currentExpansions
    });
  }

  selectKingdom(index: number, kingdom: { name: string; expansion: string; cardKey: CardKey }) {
    console.log('selectKingdom', index, kingdom);


  }
}
