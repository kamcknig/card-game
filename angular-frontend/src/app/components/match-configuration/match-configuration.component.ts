import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { CardNoId, EventNoId, ExpansionListElement, MatchConfiguration, PlayerId } from 'shared/shared-types';
import { NanostoresService } from '@nanostores/angular';
import { playerIdStore, selfPlayerIdStore } from '../../state/player-state';
import { combineLatest, map, Observable, Subscription } from 'rxjs';
import { AsyncPipe, NgClass, NgOptimizedImage, NgStyle } from '@angular/common';
import { expansionListStore } from '../../state/expansion-list-state';
import { matchConfigurationStore } from '../../state/match-state';
import { SocketService } from '../../core/socket-service/socket.service';
import { gameOwnerIdStore } from '../../state/game-state';
import { PlayerComponent } from './player-name-input/player-name-input.component';
import { SelectKingdomModalComponent } from './select-kingdom-modal/select-kingdom-modal.component';
import { SelectEventModalComponent } from './select-event-modal/select-event-modal.component';

@Component({
  selector: 'app-match-configuration',
  imports: [
    AsyncPipe,
    NgOptimizedImage,
    NgClass,
    PlayerComponent,
    SelectKingdomModalComponent,
    SelectEventModalComponent,
    NgStyle
  ],
  templateUrl: './match-configuration.component.html',
  styleUrl: './match-configuration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatchConfigurationComponent implements OnDestroy {
  playerIds$!: Observable<readonly PlayerId[]>;
  expansionList$!: Observable<readonly ExpansionListElement[]>;
  matchExpansions$!: Observable<readonly string[]>;
  isGameOwner: boolean = false;
  preSelectedKingdoms: (CardNoId | null)[] = [];
  // Tracks the fixed events selected for the match.
  preSelectedEvents: (EventNoId | null)[] = [];
  selectingKingdom: boolean = false;
  // Controls the event selection modal visibility.
  selectingEvents: boolean = false;
  selectingBannedCards: boolean = false
  bannedKingdoms$: Observable<readonly CardNoId[]>;

  private gameOwnerSub: Subscription;
  private bannedKingdoms: CardNoId[] = [];
  private selectedKingdomsSub: Subscription;
  // Keeps the preselected events list in sync with configuration changes.
  private selectedEventsSub: Subscription;
  // Events are capped to the base match limit.
  private readonly _maxEvents: number = 2;

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

    this.bannedKingdoms$ = this._nanoStoreService.useStore(matchConfigurationStore).pipe(
      map(config => config?.bannedKingdoms ?? [])
    );

    this.selectedKingdomsSub = this._nanoStoreService.useStore(matchConfigurationStore)
      .pipe(map(config => config?.preselectedKingdoms
        ?.sort((a, b) => a.cardKey.localeCompare(b.cardKey))))
      .subscribe(selectedKingdoms => {
        selectedKingdoms ??= []
        const remainingNulls = new Array(10 - (selectedKingdoms?.length ?? 0)).fill(null);

        for (const _ of remainingNulls) {
          selectedKingdoms.push(null as any);
        }

        this.preSelectedKingdoms = selectedKingdoms;
      });
    
    this.selectedEventsSub = this._nanoStoreService.useStore(matchConfigurationStore)
      .pipe(map(config => config?.events
        ?.sort((a, b) => a.cardKey.localeCompare(b.cardKey))))
      .subscribe(selectedEvents => {
        selectedEvents ??= [];
        const remainingNulls = new Array(this._maxEvents - (selectedEvents?.length ?? 0)).fill(null);
        
        for (const _ of remainingNulls) {
          selectedEvents.push(null as any);
        }
        
        this.preSelectedEvents = selectedEvents;
      });

    this.gameOwnerSub = combineLatest([
      this._nanoStoreService.useStore(gameOwnerIdStore),
      this._nanoStoreService.useStore(selfPlayerIdStore)
    ]).subscribe(([ownerId, playerId]) => this.isGameOwner = playerId === ownerId);

    this.preSelectedKingdoms = new Array(10).fill(null);
    // Initialize event slots to the base limit.
    this.preSelectedEvents = new Array(this._maxEvents).fill(null);
  }

  ngOnDestroy(): void {
    this.gameOwnerSub.unsubscribe();
    this.selectedKingdomsSub.unsubscribe()
    this.selectedEventsSub.unsubscribe();
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

  // Adds a single computer player to the lobby.
  addComputerPlayer() {
    this._socketService.emit('addComputerPlayer', 1);
  }

  deleteKingdom(kingdom: CardNoId) {
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
  
  // Removes a selected event from the fixed event list.
  deleteEvent(event: EventNoId) {
    const idx = this.preSelectedEvents.findIndex(k => k !== null && k?.cardKey === event.cardKey);
    this.preSelectedEvents = this.preSelectedEvents
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
  onKingdomSelected($event: CardNoId) {
    const idx = this.preSelectedKingdoms.findIndex(k => k === null);
    this.preSelectedKingdoms = this.preSelectedKingdoms.toSpliced(idx, 1, $event);
    this.selectingKingdom = false;
    this.sendMatchConfigUpdate();
  }
  
  // Adds a selected event to the fixed event list.
  onEventSelected($event: EventNoId) {
    const idx = this.preSelectedEvents.findIndex(k => k === null);
    if (idx === -1) {
      // Guard against selecting more events than the configured limit.
      return;
    }
    this.preSelectedEvents = this.preSelectedEvents.toSpliced(idx, 1, $event);
    this.selectingEvents = false;
    this.sendMatchConfigUpdate();
  }

  private sendMatchConfigUpdate() {
    this._socketService.emit('matchConfigurationUpdated', {
      ...matchConfigurationStore.get() as MatchConfiguration,
      bannedKingdoms: this.bannedKingdoms,
      // Pass the fixed events through the match configuration.
      events: this.preSelectedEvents
        .filter(event => !!event)
        .map(event => event as EventNoId),
      kingdomSupply: this.preSelectedKingdoms
        .filter(card => !card?.isBasic)
        .filter(card => !!card)
        .map(card => ({ name: card.cardKey, cards: [card] })),
      basicSupply: this.preSelectedKingdoms
        .filter(card => card?.isBasic)
        .filter(card => !!card)
        .map(card => ({ name: card.cardKey, cards: [card] }))
    });
  }

  onBannedKingdomSelected($event: CardNoId) {
    const idx = this.bannedKingdoms.findIndex(k => k.cardKey === $event.cardKey);
    if (idx === -1) {
      this.bannedKingdoms.push($event);
    }
    else {
      this.bannedKingdoms.splice(idx, 1)
    }
    this.bannedKingdoms = [...this.bannedKingdoms.sort((a, b) => a.cardKey.localeCompare(b.cardKey))];
    this.sendMatchConfigUpdate();
  }

  deleteBannedKingdom(bannedCard: CardNoId) {
    this.onBannedKingdomSelected(bannedCard);
  }
}
