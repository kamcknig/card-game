import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
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
import { NgOptimizedImage } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { selectableSearchCatalogStore } from '../../../state/selectable-search-state';
import { openCardDetailDialog } from '../../../state/card-detail-dialog-state';
import { Subject, debounceTime, startWith } from 'rxjs';
import { LucideAngularModule, Search, X, Check } from 'lucide-angular';

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

/** Card tile enriched with display-ready computed properties. */
type DisplaySearchResult = SelectableSearchResult & {
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  /** Treasure (gold) cost shown in the info area. */
  costValue: number;
  /** Potion cost; 0 when none. */
  potionCost: number;
  /** Debt cost; 0 when none. */
  debtCost: number;
  /** Primary type label shown in the info area. */
  primaryTypeLabel: string;
};

/** Returns the display-friendly primary type label (e.g. 'ACTION' → 'Action'). */
function getPrimaryTypeLabel(types: CardType[]): string {
  const priority: CardType[] = ['DURATION', 'TREASURE', 'VICTORY', 'CURSE', 'NIGHT', 'ATTACK', 'REACTION', 'ACTION'];
  const primary = priority.find((t) => types.includes(t)) ?? types[0];
  if (!primary) return '';
  return primary.charAt(0) + primary.slice(1).toLowerCase();
}

@Component({
  selector: 'app-select-card-like-modal',
  imports: [NgOptimizedImage, LucideAngularModule],
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

  /** Filtered, display-enriched result list driven by search term and type filter. */
  readonly displaySearchResults = computed<readonly DisplaySearchResult[]>(() => {
    const searchTerm = this.searchTermValue().trim().toLowerCase();
    const typeFilter = this.activeTypeFilter();
    const imageSize = this.imageSize();

    return this.allCatalogResults()
      .filter((result) => {
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
      })
      .map((result) => {
        const types: CardType[] = 'type' in result && Array.isArray(result.type)
          ? (result.type as CardType[])
          : [];
        const imagePath = imageSize === 'half' && 'halfImagePath' in result
          ? (result as CardNoId).halfImagePath
          : result.fullImagePath;
        return {
          ...result,
          imagePath,
          imageWidth: imageSize === 'half' ? 150 : 280,
          imageHeight: imageSize === 'half' ? 150 : 124,
          costValue: result.cost?.treasure ?? 0,
          potionCost: result.cost?.potion ?? 0,
          debtCost: result.cost?.debt ?? 0,
          primaryTypeLabel: getPrimaryTypeLabel(types),
        };
      });
  });

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

  /** Routes keyboard Escape to cancel. */
  @HostListener('keydown.escape')
  onEscapeKey(): void {
    this.onCancel();
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

  /**
   * Opens the global card detail overlay for the right-clicked item.
   * Suppresses the native browser context menu.
   */
  onContextMenu(event: MouseEvent, item: DisplaySearchResult): void {
    event.preventDefault();
    event.stopPropagation();
    if (item.detailImagePath?.trim()) {
      openCardDetailDialog(item.detailImagePath);
    }
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
