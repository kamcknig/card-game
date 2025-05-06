import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component, ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { combineLatestWith, debounceTime, filter, Subject, Subscription } from 'rxjs';
import { SocketService } from '../../../core/socket-service/socket.service';
import { NanostoresService } from '@nanostores/angular';
import { CardNoId } from 'shared/shared-types';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH } from '../../../core/app-contants';
import { selfPlayerIdStore } from '../../../state/player-state';

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
export class SelectKingdomModalComponent implements OnDestroy, AfterViewInit {
  protected readonly SMALL_CARD_HEIGHT = SMALL_CARD_HEIGHT;
  protected readonly SMALL_CARD_WIDTH = SMALL_CARD_WIDTH;
  private searchSub: Subscription;

  @Input() excludedKingdoms: (CardNoId | null)[] = [];

  @Output() close: EventEmitter<void> = new EventEmitter();
  @Output() kingdomSelected: EventEmitter<CardNoId> = new EventEmitter();

  @ViewChild('searchTermInput', { static: true }) searchTerm!: ElementRef<HTMLInputElement>;

  searchTerm$: Subject<string> = new Subject();
  searchResults$: Subject<CardNoId[]> = new Subject();

  constructor(
    private _socketService: SocketService,
    private _nanoService: NanostoresService,
  ) {
    this._socketService
      .on('searchCardResponse', results =>
        this.searchResults$.next(results.filter(r => {
          if (r.isBasic) return false;

          const currentSelectedKingdomCardKeys = this.excludedKingdoms.map(k => k?.cardKey).filter(k => k !== null);
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

  ngAfterViewInit(): void {
    setTimeout(() => this.searchTerm?.nativeElement.focus(), 0);
  }

  updateSearchTerm(term: string) {
    this.searchTerm$.next(term);
  }

  ngOnDestroy(): void {
    this._socketService.off('searchCardResponse');
    this.searchSub.unsubscribe();
  }

  onKingdomSelected(card: CardNoId) {
    this.kingdomSelected.emit(card);
    this.searchResults$.next([]);
    this.close.emit();
  }

  onClose() {
    this.searchResults$.next([]);
    this.close.emit();
  }
}
