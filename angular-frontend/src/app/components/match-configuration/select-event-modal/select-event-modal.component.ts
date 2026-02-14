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
import { EventNoId } from 'shared/types';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import {EVENT_CARD_HEIGHT, EVENT_CARD_WIDTH, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH} from '../../../core/app-contants';
import { selfPlayerIdStore } from '../../../state/player-state';

@Component({
  selector: 'app-select-event-modal',
  imports: [
    AsyncPipe,
    NgOptimizedImage
  ],
  templateUrl: './select-event-modal.component.html',
  styleUrl: './select-event-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectEventModalComponent implements OnDestroy, AfterViewInit {
  protected readonly EVENT_CARD_HEIGHT = EVENT_CARD_HEIGHT;
  protected readonly EVENT_CARD_WIDTH = EVENT_CARD_WIDTH;
  private searchSub: Subscription;

  @Input() excludedEvents: (EventNoId | null)[] = [];

  @Output() close: EventEmitter<void> = new EventEmitter();
  @Output() eventSelected: EventEmitter<EventNoId> = new EventEmitter();

  @ViewChild('searchTermInput', { static: true }) searchTerm!: ElementRef<HTMLInputElement>;

  // Drives the search term stream for event lookup.
  searchTerm$: Subject<string> = new Subject();
  // Emits the current event search results.
  searchResults$: Subject<EventNoId[]> = new Subject();

  constructor(
    private _socketService: SocketService,
    private _nanoService: NanostoresService,
  ) {
    this._socketService
      .on('searchEventResponse', results =>
        this.searchResults$.next(results.filter(r => {
          const currentSelectedEventKeys = this.excludedEvents.map(k => k?.cardKey).filter(k => k !== null);
          return !currentSelectedEventKeys.some(k => k === r.cardKey);
        })));

    this.searchSub = this.searchTerm$.pipe(
      debounceTime(300),
      combineLatestWith(this._nanoService.useStore(selfPlayerIdStore)),
      filter(([, selfId]) => selfId !== undefined)
    ).subscribe(([searchTerm, selfId]) => {
      this._socketService.emit('searchEvents', selfId!, searchTerm);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.searchTerm?.nativeElement.focus(), 0);
  }

  // Updates the event search term used by the modal.
  updateSearchTerm(term: string) {
    this.searchTerm$.next(term);
  }

  ngOnDestroy(): void {
    this._socketService.off('searchEventResponse');
    this.searchSub.unsubscribe();
  }

  // Emits the selected event and closes the modal.
  onEventSelected(event: EventNoId) {
    this.eventSelected.emit(event);
    this.searchResults$.next([]);
    this.close.emit();
  }

  // Closes the modal and clears search results.
  onClose() {
    this.searchResults$.next([]);
    this.close.emit();
  }
}
