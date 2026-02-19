import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { combineLatestWith, debounceTime, filter, Subject } from 'rxjs';
import { SocketService } from '../../../core/socket-service/socket.service';
import { NanostoresService } from '@nanostores/angular';
import {
  CardNoId,
  ArtifactNoId,
  EventNoId,
  LandmarkNoId,
  ProjectNoId,
  ServerListenEvents,
  WayNoId
} from 'shared/types';
import { NgOptimizedImage } from '@angular/common';
import { EVENT_CARD_HEIGHT, EVENT_CARD_WIDTH, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH } from '../../../core/app-contants';
import { selfPlayerIdStore } from '../../../state/player-state';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type SelectableCardLikeNoId = EventNoId | LandmarkNoId | ArtifactNoId | ProjectNoId | WayNoId;
export type SelectableSearchResult = CardNoId | SelectableCardLikeNoId;
export type SearchRequestEventName =
  'searchCards'
  | 'searchEvents'
  | 'searchLandmarks'
  | 'searchArtifacts'
  | 'searchProjects'
  | 'searchWays';
export type SearchResponseEventName =
  'searchCardResponse'
  | 'searchEventResponse'
  | 'searchLandmarkResponse'
  | 'searchArtifactResponse'
  | 'searchProjectResponse'
  | 'searchWayResponse';
type SearchRequestEvents = Pick<ServerListenEvents, SearchRequestEventName>;

type DisplaySearchResult = SelectableSearchResult & {
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
};

@Component({
  selector: 'app-select-card-like-modal',
  imports: [
    NgOptimizedImage
  ],
  templateUrl: './select-card-like-modal.component.html',
  styleUrl: './select-card-like-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectCardLikeModalComponent implements AfterViewInit {
  private readonly _socketService = inject(SocketService);
  private readonly _nanoService = inject(NanostoresService);

  excludedItems = input<({ cardKey: string; } | null)[]>([]);
  searchRequestEvent = input.required<SearchRequestEventName>();
  searchResponseEvent = input.required<SearchResponseEventName>();
  // When true, removes basic cards from search results (used for kingdom/banned selection).
  filterBasicCards = input(false);
  // Controls whether this modal renders half-image or full-image cards.
  imageSize = input<'half' | 'full'>('full');

  close = output<void>();
  itemSelected = output<SelectableSearchResult>();

  @ViewChild('searchTermInput', { static: true }) searchTerm!: ElementRef<HTMLInputElement>;

  // Drives the search term stream for card-like lookup.
  searchTerm$ = new Subject<string>();
  // Latest raw search term entered by the user.
  readonly searchTermValue = signal('');
  // Raw search results from the socket response event.
  private readonly _rawSearchResults = signal<SelectableSearchResult[]>([]);
  // Tracks whether a search request is currently waiting for a server response.
  private readonly _searchRequestInFlight = signal(false);
  // Tracks whether at least one response has arrived for the current non-empty query.
  private readonly _hasReceivedSearchResponse = signal(false);

  // Template-ready result list with stable filtering and image sizing.
  readonly displaySearchResults = computed<readonly DisplaySearchResult[]>(() => {
    const excludedKeys = this.excludedItems()
      .map((cardLike) => cardLike?.cardKey)
      .filter((cardKey): cardKey is string => !!cardKey);
    const filterBasicCards = this.filterBasicCards();
    const imageSize = this.imageSize();
    const imageWidth = imageSize === 'half' ? SMALL_CARD_WIDTH : EVENT_CARD_WIDTH;
    const imageHeight = imageSize === 'half' ? SMALL_CARD_HEIGHT : EVENT_CARD_HEIGHT;

    const filteredResults = filterBasicCards
      ? this._rawSearchResults().filter((result) => !('isBasic' in result) || !result.isBasic)
      : this._rawSearchResults();

    return filteredResults
      .filter((result) => !excludedKeys.some((cardKey) => cardKey === result.cardKey))
      .map((result) => ({
        ...result,
        imagePath: imageSize === 'half' && 'halfImagePath' in result ? result.halfImagePath : result.fullImagePath,
        imageWidth,
        imageHeight,
      }));
  });

  // Only show "no results" after an actual response for the active query.
  readonly shouldShowNoResults = computed(() => {
    const hasQuery = this.searchTermValue().trim().length > 0;
    return hasQuery
      && this._hasReceivedSearchResponse()
      && !this._searchRequestInFlight()
      && this.displaySearchResults().length === 0;
  });

  // Emits debounced search requests scoped to the active player.
  private readonly _searchTermSubscription = this.searchTerm$.pipe(
    debounceTime(300),
    combineLatestWith(this._nanoService.useStore(selfPlayerIdStore)),
    filter(([searchTerm, selfId]) => selfId !== undefined && searchTerm.trim().length > 0),
    takeUntilDestroyed(),
  ).subscribe(([searchTerm, selfId]) => {
    // Mark request pending so empty local results do not show as "no results" prematurely.
    this._searchRequestInFlight.set(true);
    this._socketService.emit(this.searchRequestEvent() as keyof SearchRequestEvents, selfId!, searchTerm);
  });

  // Re-binds socket listener whenever the response-event input changes.
  private readonly _searchResponseListenerEffect = effect((onCleanup) => {
    const responseEvent = this.searchResponseEvent();
    const responseHandler = (results: SelectableSearchResult[]) => {
      // Ignore late responses when the active query has already been cleared.
      if (this.searchTermValue().trim().length < 1) {
        this._rawSearchResults.set([]);
        this._searchRequestInFlight.set(false);
        this._hasReceivedSearchResponse.set(false);
        return;
      }
      this._rawSearchResults.set(results);
      this._searchRequestInFlight.set(false);
      this._hasReceivedSearchResponse.set(true);
    };

    this._socketService.on(responseEvent, responseHandler as any);
    onCleanup(() => {
      this._socketService.off(responseEvent, responseHandler as any);
    });
  });

  ngAfterViewInit(): void {
    setTimeout(() => this.searchTerm?.nativeElement.focus(), 0);
  }

  // Updates the search term used by the modal.
  updateSearchTerm(term: string) {
    this.searchTermValue.set(term);
    // Reset visible state immediately when query changes.
    this._hasReceivedSearchResponse.set(false);
    const hasQuery = term.trim().length > 0;
    this._searchRequestInFlight.set(hasQuery);
    if (!hasQuery) {
      this._rawSearchResults.set([]);
      this._searchRequestInFlight.set(false);
    }
    this.searchTerm$.next(term);
  }

  // Emits the selected item and closes the modal.
  onItemSelected(item: SelectableSearchResult) {
    this.itemSelected.emit(item);
    this._rawSearchResults.set([]);
    this._searchRequestInFlight.set(false);
    this._hasReceivedSearchResponse.set(false);
    this.close.emit();
  }

  // Closes the modal and clears search results.
  onClose() {
    this._rawSearchResults.set([]);
    this._searchRequestInFlight.set(false);
    this._hasReceivedSearchResponse.set(false);
    this.close.emit();
  }
}
