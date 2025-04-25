import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { combineLatestWith, debounceTime, filter, Subject, Subscription } from 'rxjs';
import { SocketService } from '../../../core/socket-service/socket.service';
import { NanostoresService } from '@nanostores/angular';
import { selfPlayerIdStore } from '../../../state/match-state';
import { CardData, CardKey, MatchPreselectedKingdom } from 'shared/shared-types';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH } from '../../../core/app-contants';

@Component({
  selector: 'app-select-kingdom-modal',
  imports: [
    AsyncPipe,
    NgOptimizedImage
  ],
  templateUrl: './select-kingdom-modal.component.html',
  styleUrl: './select-kingdom-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectKingdomModalComponent implements OnDestroy {
  protected readonly SMALL_CARD_HEIGHT = SMALL_CARD_HEIGHT;
  protected readonly SMALL_CARD_WIDTH = SMALL_CARD_WIDTH;
  private searchSub: Subscription;

  @Input() selectedKingdoms: (MatchPreselectedKingdom | null)[] = [];
  @Output() close: EventEmitter<void> = new EventEmitter();
  @Output() kingdomSelected: EventEmitter<CardData & { cardKey: CardKey }> = new EventEmitter();
  searchTerm$: Subject<string> = new Subject();
  searchResults$: Subject<(CardData & { cardKey: CardKey })[]> = new Subject();

  constructor(
    private _socketService: SocketService,
    private _nanoService: NanostoresService,
  ) {
    this._socketService
      .on('searchCardResponse', results =>
        this.searchResults$.next(results.filter(r => {
          const currentSelectedKingdomCardKeys = this.selectedKingdoms.map(k => k?.cardKey).filter(k => k !== null);
          return !currentSelectedKingdomCardKeys.some(k => k === r.cardKey);
        })));

    this.searchSub = this.searchTerm$.pipe(
      debounceTime(300),
      combineLatestWith(this._nanoService.useStore(selfPlayerIdStore)),
      filter(([, selfId]) => selfId !== undefined)
    ).subscribe(([searchTerm, selfId]) => {
      this._socketService.emit('searchCards', selfId!, searchTerm);
    });
  }

  updateSearchTerm(term: string) {
    this.searchTerm$.next(term);
  }

  ngOnDestroy(): void {
    this._socketService.off('searchCardResponse');
    this.searchSub.unsubscribe();
  }

  onKingdomSelected(card: MatchPreselectedKingdom) {
    this.kingdomSelected.emit(card);
    this.searchResults$.next([]);
    this.close.emit();
  }
}
