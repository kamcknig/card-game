import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import {
  AllyNoId,
  CardNoId,
  ArtifactNoId,
  EventNoId,
  LandmarkNoId,
  ProjectNoId,
  SelectableSearchCatalog,
  TraitNoId,
  WayNoId,
} from 'shared/types';
import { NgOptimizedImage } from '@angular/common';
import { EVENT_CARD_HEIGHT, EVENT_CARD_WIDTH, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH } from '../../../core/app-contants';
import { toSignal } from '@angular/core/rxjs-interop';
import { selectableSearchCatalogStore } from '../../../state/selectable-search-state';

export type SelectableCardLikeNoId =
  | EventNoId
  | LandmarkNoId
  | ArtifactNoId
  | ProjectNoId
  | WayNoId
  | TraitNoId
  | AllyNoId;
export type SelectableSearchResult = CardNoId | SelectableCardLikeNoId;
export type SearchCatalogKind = keyof SelectableSearchCatalog;

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
  private readonly _nanoService = inject(NanostoresService);

  excludedItems = input<({ cardKey: string; } | null)[]>([]);
  catalogKind = input.required<SearchCatalogKind>();
  // When true, removes basic cards from search results (used for kingdom/banned selection).
  filterBasicCards = input(false);
  // Controls whether this modal renders half-image or full-image cards.
  imageSize = input<'half' | 'full'>('full');

  close = output<void>();
  itemSelected = output<SelectableSearchResult>();

  @ViewChild('searchTermInput', { static: true }) searchTerm!: ElementRef<HTMLInputElement>;

  // Latest raw search term entered by the user.
  readonly searchTermValue = signal('');
  private readonly _searchCatalog = toSignal(this._nanoService.useStore(selectableSearchCatalogStore), {
    initialValue: selectableSearchCatalogStore.get()
  });

  // Template-ready result list with stable filtering and image sizing.
  readonly displaySearchResults = computed<readonly DisplaySearchResult[]>(() => {
    const catalog = this._searchCatalog();
    const catalogKind = this.catalogKind();
    const excludedKeys = this.excludedItems()
      .map((cardLike) => cardLike?.cardKey)
      .filter((cardKey): cardKey is string => !!cardKey);
    const filterBasicCards = this.filterBasicCards();
    const searchTerm = this.searchTermValue().trim().toLowerCase();
    const imageSize = this.imageSize();
    const imageWidth = imageSize === 'half' ? SMALL_CARD_WIDTH : EVENT_CARD_WIDTH;
    const imageHeight = imageSize === 'half' ? SMALL_CARD_HEIGHT : EVENT_CARD_HEIGHT;
    const allCatalogResults = this.getCatalogResults(catalog, catalogKind);
    const matchingResults = searchTerm.length < 1
      ? allCatalogResults
      : allCatalogResults.filter((result) =>
        result.cardName.toLowerCase().includes(searchTerm)
        || result.cardKey.toLowerCase().includes(searchTerm)
      );

    const filteredResults = filterBasicCards
      ? matchingResults.filter((result) => !('isBasic' in result) || !result.isBasic)
      : matchingResults;

    return filteredResults
      .filter((result) => !excludedKeys.some((cardKey) => cardKey === result.cardKey))
      .map((result) => ({
        ...result,
        imagePath: imageSize === 'half' && 'halfImagePath' in result ? result.halfImagePath : result.fullImagePath,
        imageWidth,
        imageHeight,
      }));
  });

  // Shows "no results" only when a non-empty local filter has no matches.
  readonly shouldShowNoResults = computed(() => {
    return this.searchTermValue().trim().length > 0 && this.displaySearchResults().length === 0;
  });

  ngAfterViewInit(): void {
    setTimeout(() => this.searchTerm?.nativeElement.focus(), 0);
  }

  // Updates the search term used by the modal.
  updateSearchTerm(term: string) {
    this.searchTermValue.set(term);
  }

  // Emits the selected item and closes the modal.
  onItemSelected(item: SelectableSearchResult) {
    this.itemSelected.emit(item);
    this.close.emit();
  }

  // Closes the modal and clears search results.
  onClose() {
    this.close.emit();
  }

  // Returns the cached selectable results for the requested catalog kind.
  private getCatalogResults(
    catalog: SelectableSearchCatalog,
    catalogKind: SearchCatalogKind
  ): SelectableSearchResult[] {
    switch (catalogKind) {
      case 'cards':
        return catalog.cards;
      case 'events':
        return catalog.events;
      case 'landmarks':
        return catalog.landmarks;
      case 'artifacts':
        return catalog.artifacts;
      case 'projects':
        return catalog.projects;
      case 'ways':
        return catalog.ways;
      case 'traits':
        return catalog.traits;
      case 'allies':
        return catalog.allies;
    }
    return [];
  }
}
