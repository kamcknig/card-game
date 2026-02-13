import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { combineLatestWith, debounceTime, filter, Subject, Subscription } from 'rxjs';
import { SocketService } from '../../../core/socket-service/socket.service';
import { NanostoresService } from '@nanostores/angular';
import { LandmarkNoId } from 'shared/types/index.ts';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { EVENT_CARD_HEIGHT, EVENT_CARD_WIDTH } from '../../../core/app-contants';
import { selfPlayerIdStore } from '../../../state/player-state';

@Component({
  selector: 'app-select-landmark-modal',
  imports: [
    AsyncPipe,
    NgOptimizedImage
  ],
  templateUrl: './select-landmark-modal.component.html',
  styleUrl: './select-landmark-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectLandmarkModalComponent implements OnDestroy, AfterViewInit {
  protected readonly EVENT_CARD_HEIGHT = EVENT_CARD_HEIGHT;
  protected readonly EVENT_CARD_WIDTH = EVENT_CARD_WIDTH;
  private searchSub: Subscription;

  @Input() excludedLandmarks: (LandmarkNoId | null)[] = [];

  @Output() close: EventEmitter<void> = new EventEmitter();
  @Output() landmarkSelected: EventEmitter<LandmarkNoId> = new EventEmitter();

  @ViewChild('searchTermInput', { static: true }) searchTerm!: ElementRef<HTMLInputElement>;

  // Drives the search term stream for landmark lookup.
  searchTerm$: Subject<string> = new Subject();
  // Emits the current landmark search results.
  searchResults$: Subject<LandmarkNoId[]> = new Subject();

  constructor(
    private _socketService: SocketService,
    private _nanoService: NanostoresService,
  ) {
    this._socketService
      .on('searchLandmarkResponse', results =>
        this.searchResults$.next(results.filter(r => {
          const currentSelectedLandmarkKeys = this.excludedLandmarks.map(k => k?.cardKey).filter(k => k !== null);
          return !currentSelectedLandmarkKeys.some(k => k === r.cardKey);
        })));

    this.searchSub = this.searchTerm$.pipe(
      debounceTime(300),
      combineLatestWith(this._nanoService.useStore(selfPlayerIdStore)),
      filter(([, selfId]) => selfId !== undefined)
    ).subscribe(([searchTerm, selfId]) => {
      this._socketService.emit('searchLandmarks', selfId!, searchTerm);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.searchTerm?.nativeElement.focus(), 0);
  }

  // Updates the landmark search term used by the modal.
  updateSearchTerm(term: string) {
    this.searchTerm$.next(term);
  }

  ngOnDestroy(): void {
    this._socketService.off('searchLandmarkResponse');
    this.searchSub.unsubscribe();
  }

  // Emits the selected landmark and closes the modal.
  onLandmarkSelected(landmark: LandmarkNoId) {
    this.landmarkSelected.emit(landmark);
    this.searchResults$.next([]);
    this.close.emit();
  }

  // Closes the modal and clears search results.
  onClose() {
    this.searchResults$.next([]);
    this.close.emit();
  }
}
