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
import { ArtifactNoId } from 'shared/types/index.ts';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { EVENT_CARD_HEIGHT, EVENT_CARD_WIDTH } from '../../../core/app-contants';
import { selfPlayerIdStore } from '../../../state/player-state';

@Component({
  selector: 'app-select-artifact-modal',
  imports: [
    AsyncPipe,
    NgOptimizedImage
  ],
  templateUrl: './select-artifact-modal.component.html',
  styleUrl: './select-artifact-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectArtifactModalComponent implements OnDestroy, AfterViewInit {
  protected readonly EVENT_CARD_HEIGHT = EVENT_CARD_HEIGHT;
  protected readonly EVENT_CARD_WIDTH = EVENT_CARD_WIDTH;
  private searchSub: Subscription;

  @Input() excludedArtifacts: (ArtifactNoId | null)[] = [];

  @Output() close: EventEmitter<void> = new EventEmitter();
  @Output() artifactSelected: EventEmitter<ArtifactNoId> = new EventEmitter();

  @ViewChild('searchTermInput', { static: true }) searchTerm!: ElementRef<HTMLInputElement>;

  // Drives the search term stream for artifact lookup.
  searchTerm$: Subject<string> = new Subject();
  // Emits the current artifact search results.
  searchResults$: Subject<ArtifactNoId[]> = new Subject();

  constructor(
    private _socketService: SocketService,
    private _nanoService: NanostoresService,
  ) {
    this._socketService
      .on('searchArtifactResponse', results =>
        this.searchResults$.next(results.filter(r => {
          const currentSelectedArtifactKeys = this.excludedArtifacts.map(k => k?.cardKey).filter(k => k !== null);
          return !currentSelectedArtifactKeys.some(k => k === r.cardKey);
        })));

    this.searchSub = this.searchTerm$.pipe(
      debounceTime(300),
      combineLatestWith(this._nanoService.useStore(selfPlayerIdStore)),
      filter(([, selfId]) => selfId !== undefined)
    ).subscribe(([searchTerm, selfId]) => {
      this._socketService.emit('searchArtifacts', selfId!, searchTerm);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.searchTerm?.nativeElement.focus(), 0);
  }

  // Updates the artifact search term used by the modal.
  updateSearchTerm(term: string) {
    this.searchTerm$.next(term);
  }

  ngOnDestroy(): void {
    this._socketService.off('searchArtifactResponse');
    this.searchSub.unsubscribe();
  }

  // Emits the selected artifact and closes the modal.
  onArtifactSelected(artifact: ArtifactNoId) {
    this.artifactSelected.emit(artifact);
    this.searchResults$.next([]);
    this.close.emit();
  }

  // Closes the modal and clears search results.
  onClose() {
    this.searchResults$.next([]);
    this.close.emit();
  }
}
