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
import { ProjectNoId } from 'shared/types';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { EVENT_CARD_HEIGHT, EVENT_CARD_WIDTH } from '../../../core/app-contants';
import { selfPlayerIdStore } from '../../../state/player-state';

@Component({
  selector: 'app-select-project-modal',
  imports: [
    AsyncPipe,
    NgOptimizedImage
  ],
  templateUrl: './select-project-modal.component.html',
  styleUrl: './select-project-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectProjectModalComponent implements OnDestroy, AfterViewInit {
  protected readonly EVENT_CARD_HEIGHT = EVENT_CARD_HEIGHT;
  protected readonly EVENT_CARD_WIDTH = EVENT_CARD_WIDTH;
  private searchSub: Subscription;

  @Input() excludedProjects: (ProjectNoId | null)[] = [];

  @Output() close: EventEmitter<void> = new EventEmitter();
  @Output() projectSelected: EventEmitter<ProjectNoId> = new EventEmitter();

  @ViewChild('searchTermInput', { static: true }) searchTerm!: ElementRef<HTMLInputElement>;

  // Drives the search term stream for project lookup.
  searchTerm$: Subject<string> = new Subject();
  // Emits the current project search results.
  searchResults$: Subject<ProjectNoId[]> = new Subject();

  constructor(
    private _socketService: SocketService,
    private _nanoService: NanostoresService,
  ) {
    this._socketService
      .on('searchProjectResponse', results =>
        this.searchResults$.next(results.filter(r => {
          const currentSelectedProjectKeys = this.excludedProjects.map(k => k?.cardKey).filter(k => k !== null);
          return !currentSelectedProjectKeys.some(k => k === r.cardKey);
        })));

    this.searchSub = this.searchTerm$.pipe(
      debounceTime(300),
      combineLatestWith(this._nanoService.useStore(selfPlayerIdStore)),
      filter(([, selfId]) => selfId !== undefined)
    ).subscribe(([searchTerm, selfId]) => {
      this._socketService.emit('searchProjects', selfId!, searchTerm);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.searchTerm?.nativeElement.focus(), 0);
  }

  // Updates the project search term used by the modal.
  updateSearchTerm(term: string) {
    this.searchTerm$.next(term);
  }

  ngOnDestroy(): void {
    this._socketService.off('searchProjectResponse');
    this.searchSub.unsubscribe();
  }

  // Emits the selected project and closes the modal.
  onProjectSelected(project: ProjectNoId) {
    this.projectSelected.emit(project);
    this.searchResults$.next([]);
    this.close.emit();
  }

  // Closes the modal and clears search results.
  onClose() {
    this.searchResults$.next([]);
    this.close.emit();
  }
}
