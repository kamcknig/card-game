import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { ExpansionListElement, MatchConfiguration, MatchPreselectedKingdom, PlayerId } from 'shared/shared-types';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore } from '../../state/player-state';
import { combineLatest, map, Observable, Subscription } from 'rxjs';
import { AsyncPipe, NgClass, NgOptimizedImage, NgStyle } from '@angular/common';
import { expansionListStore } from '../../state/expansion-list-state';
import { matchConfigurationStore, selfPlayerIdStore } from '../../state/match-state';
import { SocketService } from '../../core/socket-service/socket.service';
import { gameOwnerIdStore } from '../../state/game-state';
import { PlayerComponent } from './player-name-input/player-name-input.component';
import { SelectKingdomModalComponent } from './select-kingdom-modal/select-kingdom-modal.component';

@Component({
  selector: 'app-match-configuration',
  imports: [
    AsyncPipe,
    NgOptimizedImage,
    NgClass,
    PlayerComponent,
    SelectKingdomModalComponent,
    NgStyle
  ],
  templateUrl: './match-configuration.component.html',
  styleUrl: './match-configuration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchConfigurationComponent implements OnDestroy {
  public playerIds$!: Observable<readonly PlayerId[]>;
  public expansionList$!: Observable<readonly ExpansionListElement[]>;
  public matchExpansions$!: Observable<readonly string[]>;
  public isGameOwner: boolean = false;
  public preSelectedKingdoms: (MatchPreselectedKingdom | null)[] = [];
  public selectingKingdom: boolean = false;
  private gameOwnerSub: Subscription;
  private selectedKingdomsSub: Subscription;

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

    this.selectedKingdomsSub = this._nanoStoreService.useStore(matchConfigurationStore)
      .pipe(map(config =>
        (config?.kingdomCards?.concat(config?.supplyCards) ?? [])
          .sort((a, b) => a.cardKey.localeCompare(b.cardKey))))
      .subscribe(selectedKingdoms => {
        const remainingNulls = new Array(10 - selectedKingdoms.length).fill(null);

        for (const _ of remainingNulls) {
          selectedKingdoms.push(null as any);
        }

        this.preSelectedKingdoms = selectedKingdoms;
      });

    this.gameOwnerSub = combineLatest([
      this._nanoStoreService.useStore(gameOwnerIdStore),
      this._nanoStoreService.useStore(selfPlayerIdStore)
    ]).subscribe(([ownerId, playerId]) => this.isGameOwner = playerId === ownerId);

    this.preSelectedKingdoms = new Array(10).fill(null);
  }

  ngOnDestroy(): void {
    this.gameOwnerSub.unsubscribe();
    this.selectedKingdomsSub.unsubscribe()
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

  deleteKingdom(kingdom: MatchPreselectedKingdom) {
    const idx = this.preSelectedKingdoms.findIndex(k => k !== null && k?.cardKey === kingdom.cardKey);
    this.preSelectedKingdoms = this.preSelectedKingdoms
      .toSpliced(idx, 1, null)
      .sort((a, b) => {
        if (a === null && b !== null) return 1;
        if (a !== null && b === null) return -1;
        else return 0;
      });

    this.sendMatchConfigUpdate();
  }

  /**
   * user has selected a kingdom card from the modal to add to the starting kingdom
   *
   * @param $event
   */
  onKingdomSelected($event: MatchPreselectedKingdom) {
    const idx = this.preSelectedKingdoms.findIndex(k => k === null);
    this.preSelectedKingdoms = this.preSelectedKingdoms.toSpliced(idx, 1, $event);
    this.selectingKingdom = false;
    this.sendMatchConfigUpdate();
  }

  private sendMatchConfigUpdate() {
    this._socketService.emit('matchConfigurationUpdated', {
      ...matchConfigurationStore.get() as MatchConfiguration,
      kingdomCards: this.preSelectedKingdoms.filter(card => card?.isKingdom).filter(card => card !== null),
      supplyCards: this.preSelectedKingdoms.filter(card => card?.isSupply).filter(card => card !== null),
    });
  }
}
