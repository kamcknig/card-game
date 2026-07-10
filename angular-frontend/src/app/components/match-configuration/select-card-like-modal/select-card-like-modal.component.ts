import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
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
  CardType,
  EventNoId,
  LandmarkNoId,
  ProphecyNoId,
  ProjectNoId,
  SelectableSearchCatalog,
  TraitNoId,
  WayNoId,
} from 'shared/types';
import { toSignal } from '@angular/core/rxjs-interop';
import { selectableSearchCatalogStore } from '../../../state/selectable-search-state';
import { Subject, debounceTime, startWith } from 'rxjs';
import { LucideAngularModule, Search, X, Check } from 'lucide-angular';
import { CardComponent } from '../../card/card.component';
import { CardLikeComponent, CardLikeKind } from '../../card-like/card-like.component';
import { UiDialogComponent } from '../../ui/dialog/ui-dialog.component';

export type SelectableCardLikeNoId =
  | EventNoId
  | LandmarkNoId
  | ArtifactNoId
  | ProjectNoId
  | WayNoId
  | TraitNoId
  | AllyNoId
  | ProphecyNoId;
export type SelectableSearchResult = CardNoId | SelectableCardLikeNoId;
export type SearchCatalogKind = keyof SelectableSearchCatalog;

// Maps a non-card catalog kind to the CardLikeKind input expected by
// <app-card-like>. The 'cards' catalog renders via <app-card> instead and
// is not represented here.
const CATALOG_KIND_TO_CARD_LIKE_KIND: Record<Exclude<SearchCatalogKind, 'cards'>, CardLikeKind> = {
  events: 'event',
  landmarks: 'landmark',
  artifacts: 'artifact',
  projects: 'project',
  ways: 'way',
  traits: 'trait',
  allies: 'ally',
  prophecies: 'prophecy',
};

// Catalog kinds whose <app-card-like> renderings should display the cost
// cluster. Matches the same showCost choices used on the match-configuration
// landscape slots so the modal preview matches the eventual selected slot.
const CATALOG_KINDS_WITH_COST: ReadonlySet<SearchCatalogKind> = new Set<SearchCatalogKind>([
  'events',
  'projects',
]);

@Component({
  selector: 'app-select-card-like-modal',
  imports: [LucideAngularModule, CardComponent, CardLikeComponent, UiDialogComponent],
  templateUrl: './select-card-like-modal.component.html',
  styleUrl: './select-card-like-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectCardLikeModalComponent implements OnInit {
  private readonly _nanoService = inject(NanostoresService);
  private readonly _searchInput$ = new Subject<string>();

  /** Native input element ref used to imperatively clear the DOM value. */
  @ViewChild('searchInput') private _searchInputEl!: ElementRef<HTMLInputElement>;

  /** Card keys that should appear pre-selected when the modal opens. */
  initialSelectionKeys = input<string[]>([]);
  /** Catalog category to display in this modal instance. */
  catalogKind = input.required<SearchCatalogKind>();
  /** When true, hides basic supply cards (used for kingdom / banned-card selection). */
  filterBasicCards = input(false);
  /**
   * Controls whether cards are shown as compact grid tiles (half) or full
   * landscape images (full). Half = kingdom/banned cards; full = landscapes.
   */
  imageSize = input<'half' | 'full'>('full');
  /** Display title shown in the modal header. */
  title = input('Select Cards');
  /** Maximum number of cards that may be selected simultaneously. */
  maxSelections = input(Infinity);

  /** Emitted when the user confirms their selection; carries the full new selection. */
  confirmed = output<SelectableSearchResult[]>();
  /** Emitted on cancel, close button, or Escape key. */
  close = output<void>();

  /** Lucide icon references required by the template. */
  readonly SearchIcon = Search;
  readonly XIcon = X;
  readonly CheckIcon = Check;

  /** Debounced search term used to filter the grid. */
  readonly searchTermValue = toSignal(
    this._searchInput$.pipe(debounceTime(150), startWith('')),
    { initialValue: '' }
  );

  /** Raw (un-debounced) search term — drives clear button visibility immediately. */
  readonly rawSearchTerm = signal('');

  /** Active type chip filters; empty set = show all types. */
  readonly activeTypeFilter = signal(new Set<string>());

  /** Set of currently selected card keys. */
  readonly selectedCardKeys = signal(new Set<string>());

  private readonly _searchCatalog = toSignal(
    this._nanoService.useStore(selectableSearchCatalogStore),
    { initialValue: selectableSearchCatalogStore.get() }
  );

  /** Full unfiltered result list for the active catalog kind, minus basic cards when requested. */
  readonly allCatalogResults = computed<readonly SelectableSearchResult[]>(() => {
    const catalog = this._searchCatalog();
    const catalogKind = this.catalogKind();
    const filterBasicCards = this.filterBasicCards();
    const all = this.getCatalogResults(catalog, catalogKind);
    return filterBasicCards
      ? all.filter((r) => !('isBasic' in r) || !r.isBasic)
      : all;
  });

  /** Distinct card types present in the full result set, sorted alphabetically. */
  readonly availableTypes = computed<string[]>(() => {
    const typeSet = new Set<string>();
    for (const result of this.allCatalogResults()) {
      if ('type' in result && Array.isArray(result.type)) {
        for (const t of result.type as CardType[]) {
          typeSet.add(t);
        }
      }
    }
    return [...typeSet].sort();
  });

  /** Filtered result list driven by search term and type filter. */
  readonly displaySearchResults = computed<readonly SelectableSearchResult[]>(() => {
    const searchTerm = this.searchTermValue().trim().toLowerCase();
    const typeFilter = this.activeTypeFilter();

    return this.allCatalogResults().filter((result) => {
      if (typeFilter.size > 0) {
        const types = 'type' in result ? (result.type as CardType[]) : [];
        if (!types.some((t) => typeFilter.has(t))) return false;
      }
      if (searchTerm.length < 1) return true;
      if (result.cardName.toLowerCase().includes(searchTerm)) return true;
      if (result.cardKey.toLowerCase().includes(searchTerm)) return true;
      if ('type' in result && Array.isArray(result.type)) {
        if ((result.type as string[]).some((t) => t.toLowerCase().includes(searchTerm))) return true;
      }
      if ('expansionName' in result && typeof result.expansionName === 'string') {
        if (result.expansionName.toLowerCase().includes(searchTerm)) return true;
      }
      return false;
    });
  });

  // Narrowed view of displaySearchResults() for the half-image (cards) branch
  // of the template — the 'cards' catalog is the only one that ever sets
  // imageSize='half', so every entry in the filtered list is a CardNoId.
  // Returning the narrowed type lets <app-card [cardData]> accept items
  // directly without a template-level cast.
  readonly displayCardResults = computed<readonly CardNoId[]>(() => {
    if (this.imageSize() !== 'half') return [];
    return this.displaySearchResults() as readonly CardNoId[];
  });

  // Mirror narrowing for the landscape branch — every catalog except 'cards'
  // produces a SelectableCardLikeNoId.
  readonly displayCardLikeResults = computed<readonly SelectableCardLikeNoId[]>(() => {
    if (this.imageSize() !== 'full') return [];
    return this.displaySearchResults() as readonly SelectableCardLikeNoId[];
  });

  // CardLikeKind passed to <app-card-like> for the active catalog (undefined
  // when rendering plain cards via <app-card>).
  readonly cardLikeKind = computed<CardLikeKind | undefined>(() => {
    const catalogKind = this.catalogKind();
    if (catalogKind === 'cards') return undefined;
    return CATALOG_KIND_TO_CARD_LIKE_KIND[catalogKind];
  });

  // Whether <app-card-like> instances should render their cost cluster for
  // the active catalog. Matches the match-configuration landscape slot
  // showCost choices.
  readonly cardLikeShowCost = computed<boolean>(() => CATALOG_KINDS_WITH_COST.has(this.catalogKind()));

  /** True when the search and type filter together yield no results. */
  readonly shouldShowNoResults = computed(() => {
    const hasFilter = this.searchTermValue().trim().length > 0 || this.activeTypeFilter().size > 0;
    return hasFilter && this.displaySearchResults().length === 0;
  });

  /** Count of currently selected cards for the header badge. */
  readonly selectedCount = computed(() => this.selectedCardKeys().size);

  /** Total number of cards in the full (unfiltered) catalog for the footer count. */
  readonly totalCount = computed(() => this.allCatalogResults().length);

  ngOnInit(): void {
    this.selectedCardKeys.set(new Set(this.initialSelectionKeys()));
  }

  /** Updates the live search term (debounced) and the raw term (immediate). */
  updateSearchTerm(term: string): void {
    this.rawSearchTerm.set(term);
    this._searchInput$.next(term);
  }

  /** Clears the search input and resets all search state. */
  clearSearch(): void {
    this._searchInputEl.nativeElement.value = '';
    this.updateSearchTerm('');
  }

  /** Toggles a type in the active filter set. */
  onTypeFilterClick(type: string): void {
    const current = new Set(this.activeTypeFilter());
    if (current.has(type)) {
      current.delete(type);
    } else {
      current.add(type);
    }
    this.activeTypeFilter.set(current);
  }

  /** Clears all active type filters, showing all types. */
  clearTypeFilter(): void {
    this.activeTypeFilter.set(new Set());
  }

  /**
   * Toggles a card's membership in the current selection set.
   * Respects the maxSelections cap.
   */
  toggleCard(cardKey: string): void {
    const current = new Set(this.selectedCardKeys());
    if (current.has(cardKey)) {
      current.delete(cardKey);
    } else if (current.size < this.maxSelections()) {
      current.add(cardKey);
    }
    this.selectedCardKeys.set(current);
  }

  /** Returns true when the given card key is in the current selection. */
  isSelected(cardKey: string): boolean {
    return this.selectedCardKeys().has(cardKey);
  }

  /**
   * Emits the confirmed selection by mapping selected keys back to full result
   * objects from the unfiltered catalog, then closes the modal.
   */
  onConfirm(): void {
    const keys = this.selectedCardKeys();
    const selected = this.allCatalogResults().filter((r) => keys.has(r.cardKey));
    this.confirmed.emit(selected as SelectableSearchResult[]);
  }

  /** Deselects all currently selected cards without closing the modal. */
  clearSelection(): void {
    this.selectedCardKeys.set(new Set());
  }

  /** Closes the modal without emitting any selection changes. */
  onCancel(): void {
    this.close.emit();
  }

  /** Returns the display label for a type string (title-cased). */
  toTypeLabel(type: string): string {
    return type.charAt(0) + type.slice(1).toLowerCase();
  }

  /** Retrieves the raw result array for the requested catalog kind. */
  private getCatalogResults(
    catalog: SelectableSearchCatalog,
    catalogKind: SearchCatalogKind
  ): SelectableSearchResult[] {
    switch (catalogKind) {
      case 'cards': return catalog.cards;
      case 'events': return catalog.events;
      case 'landmarks': return catalog.landmarks;
      case 'artifacts': return catalog.artifacts;
      case 'projects': return catalog.projects;
      case 'ways': return catalog.ways;
      case 'traits': return catalog.traits;
      case 'allies': return catalog.allies;
      case 'prophecies': return catalog.prophecies;
    }
    return [];
  }
}
