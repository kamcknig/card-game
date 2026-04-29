import { NO_ERRORS_SCHEMA, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgOptimizedImage } from '@angular/common';
import { NanostoresService } from '@nanostores/angular';
import { of } from 'rxjs';

import { selectableSearchCatalogStore } from '../../../state/selectable-search-state';
import { SelectCardLikeModalComponent, SelectableSearchResult } from './select-card-like-modal.component';

/** Builds a minimal CardNoId-shaped object for use in tests. */
function makeCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    cardKey: 'village',
    cardName: 'Village',
    type: ['ACTION'],
    cost: { treasure: 3 },
    artImagePath: '/img/village-art.jpg',
    detailImagePath: '/img/village-detail.jpg',
    expansionName: 'Base',
    isBasic: false,
    ...overrides,
  };
}

/** Builds a minimal EventNoId-shaped object (no `type` array) for use in tests. */
function makeEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    cardKey: 'tournament',
    cardName: 'Tournament',
    artImagePath: '/img/tournament-art.jpg',
    detailImagePath: '/img/tournament-detail.jpg',
    expansionName: 'Cornucopia',
    ...overrides,
  };
}

/** Builds a minimal SelectableSearchCatalog with all required keys. */
function makeCatalog(
  cards: unknown[] = [],
  events: unknown[] = [],
): Record<string, unknown> {
  return { cards, events, landmarks: [], artifacts: [], projects: [], ways: [], traits: [], allies: [], prophecies: [] };
}

/** Stubs NanostoresService to return the current store value as a completed observable. */
class NanostoresServiceStub {
  useStore = jest.fn().mockImplementation((store: { get(): unknown }) => of(store.get()));
  ngOnDestroy = (): void => {};
}

describe('SelectCardLikeModalComponent', () => {
  let component: SelectCardLikeModalComponent;
  let fixture: ComponentFixture<SelectCardLikeModalComponent>;

  /** Creates a component instance with the given catalogKind (default: 'cards'). */
  function createComponent(catalogKind = 'cards'): void {
    fixture = TestBed.createComponent(SelectCardLikeModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('catalogKind', catalogKind);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    // Reset store to empty state before each test; individual tests override as needed.
    selectableSearchCatalogStore.set(makeCatalog() as any);

    await TestBed.configureTestingModule({
      imports: [SelectCardLikeModalComponent],
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: NanostoresService, useClass: NanostoresServiceStub },
      ],
    })
      // Remove NgOptimizedImage and add NO_ERRORS_SCHEMA directly to the standalone component
      // so [ngSrc] bindings are suppressed at the component level (standalone components ignore
      // the TestBed-level schema).
      .overrideComponent(SelectCardLikeModalComponent, {
        remove: { imports: [NgOptimizedImage] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Creation & lifecycle ──────────────────────────────────────────────────

  describe('creation', () => {
    it('should create', () => {
      createComponent();
      expect(component).toBeTruthy();
    });

    it('pre-selects all keys from initialSelectionKeys on init', () => {
      fixture = TestBed.createComponent(SelectCardLikeModalComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('catalogKind', 'cards');
      fixture.componentRef.setInput('initialSelectionKeys', ['village', 'smithy']);
      fixture.detectChanges();

      expect(component.selectedCardKeys().has('village')).toBe(true);
      expect(component.selectedCardKeys().has('smithy')).toBe(true);
      expect(component.selectedCardKeys().size).toBe(2);
    });

    it('starts with an empty selection when no initialSelectionKeys are given', () => {
      createComponent();
      expect(component.selectedCardKeys().size).toBe(0);
    });
  });

  // ── Selection management ──────────────────────────────────────────────────

  describe('selection', () => {
    beforeEach(() => createComponent());

    it('toggleCard adds a key to the selection set', () => {
      component.toggleCard('village');
      expect(component.selectedCardKeys().has('village')).toBe(true);
    });

    it('toggleCard removes a key that is already selected', () => {
      component.toggleCard('village');
      component.toggleCard('village');
      expect(component.selectedCardKeys().has('village')).toBe(false);
    });

    it('toggleCard does not add beyond the maxSelections cap', () => {
      fixture.componentRef.setInput('maxSelections', 1);
      component.toggleCard('village');
      component.toggleCard('smithy');

      expect(component.selectedCardKeys().has('village')).toBe(true);
      expect(component.selectedCardKeys().has('smithy')).toBe(false);
      expect(component.selectedCardKeys().size).toBe(1);
    });

    it('isSelected returns true for a selected key', () => {
      component.toggleCard('village');
      expect(component.isSelected('village')).toBe(true);
    });

    it('isSelected returns false for an unselected key', () => {
      expect(component.isSelected('village')).toBe(false);
    });

    it('clearSelection removes all keys from the selection', () => {
      component.toggleCard('village');
      component.toggleCard('smithy');
      component.clearSelection();
      expect(component.selectedCardKeys().size).toBe(0);
    });

    it('selectedCount reflects the size of the current selection', () => {
      expect(component.selectedCount()).toBe(0);
      component.toggleCard('village');
      expect(component.selectedCount()).toBe(1);
      component.toggleCard('smithy');
      expect(component.selectedCount()).toBe(2);
    });
  });

  // ── Search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    beforeEach(() => createComponent());

    it('updateSearchTerm sets rawSearchTerm immediately (not debounced)', () => {
      component.updateSearchTerm('village');
      expect(component.rawSearchTerm()).toBe('village');
    });

    it('clearSearch resets rawSearchTerm to empty string', () => {
      component.updateSearchTerm('village');
      component.clearSearch();
      expect(component.rawSearchTerm()).toBe('');
    });

    describe('debounced searchTermValue', () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it('clearSearch resets the debounced searchTermValue after the debounce interval', () => {
        component.updateSearchTerm('village');
        jest.advanceTimersByTime(150);
        component.clearSearch();
        jest.advanceTimersByTime(150);
        expect(component.searchTermValue()).toBe('');
      });
    });
  });

  // ── Type filter ───────────────────────────────────────────────────────────

  describe('type filter', () => {
    describe('with a card-based catalog', () => {
      beforeEach(() => {
        selectableSearchCatalogStore.set(makeCatalog([
          makeCard({ cardKey: 'village', type: ['ACTION'] }),
          makeCard({ cardKey: 'gold', type: ['TREASURE'] }),
        ]) as any);
        createComponent();
      });

      it('availableTypes extracts unique types sorted alphabetically', () => {
        expect(component.availableTypes()).toEqual(['ACTION', 'TREASURE']);
      });

      it('onTypeFilterClick adds a type to the active filter set', () => {
        component.onTypeFilterClick('ACTION');
        expect(component.activeTypeFilter().has('ACTION')).toBe(true);
      });

      it('onTypeFilterClick removes a type that is already active', () => {
        component.onTypeFilterClick('ACTION');
        component.onTypeFilterClick('ACTION');
        expect(component.activeTypeFilter().has('ACTION')).toBe(false);
      });

      it('onTypeFilterClick can activate multiple types simultaneously', () => {
        component.onTypeFilterClick('ACTION');
        component.onTypeFilterClick('TREASURE');
        expect(component.activeTypeFilter().has('ACTION')).toBe(true);
        expect(component.activeTypeFilter().has('TREASURE')).toBe(true);
      });

      it('clearTypeFilter empties the active filter set', () => {
        component.onTypeFilterClick('ACTION');
        component.onTypeFilterClick('TREASURE');
        component.clearTypeFilter();
        expect(component.activeTypeFilter().size).toBe(0);
      });
    });

    describe('with an event-based catalog (no type arrays)', () => {
      beforeEach(() => {
        selectableSearchCatalogStore.set(makeCatalog([], [makeEvent()]) as any);
        createComponent('events');
      });

      it('availableTypes returns an empty array', () => {
        expect(component.availableTypes()).toEqual([]);
      });
    });
  });

  // ── displaySearchResults ──────────────────────────────────────────────────

  describe('displaySearchResults', () => {
    const village = makeCard({ cardKey: 'village', cardName: 'Village', type: ['ACTION'], expansionName: 'Base', cost: { treasure: 3 } });
    const smithy = makeCard({ cardKey: 'smithy', cardName: 'Smithy', type: ['ACTION'], expansionName: 'Base', cost: { treasure: 4 } });
    const gold = makeCard({ cardKey: 'gold', cardName: 'Gold', type: ['TREASURE'], cost: { treasure: 0 }, isBasic: true });
    const market = makeCard({ cardKey: 'market', cardName: 'Market', type: ['ACTION', 'DURATION'], cost: { treasure: 5 } });

    describe('with a mixed catalog', () => {
      beforeEach(() => {
        selectableSearchCatalogStore.set(makeCatalog([village, smithy, gold, market]) as any);
        createComponent();
      });

      it('returns all catalog results when no filter is active', () => {
        expect(component.displaySearchResults().length).toBe(4);
      });

      describe('debounced search term filtering', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        it('filters by cardName after the debounce interval', () => {
          component.updateSearchTerm('village');
          jest.advanceTimersByTime(150);
          expect(component.displaySearchResults().map((r) => r.cardKey)).toEqual(['village']);
        });

        it('search is case-insensitive', () => {
          component.updateSearchTerm('VILLAGE');
          jest.advanceTimersByTime(150);
          expect(component.displaySearchResults().map((r) => r.cardKey)).toEqual(['village']);
        });

        it('returns no results when the search term matches nothing', () => {
          component.updateSearchTerm('xyznotfound');
          jest.advanceTimersByTime(150);
          expect(component.displaySearchResults().length).toBe(0);
        });
      });

      it('filters to cards matching a single active type chip', () => {
        component.onTypeFilterClick('TREASURE');
        expect(component.displaySearchResults().map((r) => r.cardKey)).toEqual(['gold']);
      });

      it('shows cards matching ANY selected type when multiple chips are active', () => {
        component.onTypeFilterClick('TREASURE');
        component.onTypeFilterClick('DURATION');
        // gold has TREASURE; market has DURATION (among others)
        const keys = component.displaySearchResults().map((r) => r.cardKey);
        expect(keys).toContain('gold');
        expect(keys).toContain('market');
        expect(keys).not.toContain('village');
        expect(keys).not.toContain('smithy');
      });

      it('enriches each result with costValue from the treasure cost', () => {
        const result = component.displaySearchResults().find((r) => r.cardKey === 'village') as any;
        expect(result.costValue).toBe(3);
      });

      it('enriches each result with potionCost defaulting to 0 when absent', () => {
        const result = component.displaySearchResults().find((r) => r.cardKey === 'village') as any;
        expect(result.potionCost).toBe(0);
      });

      it('enriches each result with debtCost defaulting to 0 when absent', () => {
        const result = component.displaySearchResults().find((r) => r.cardKey === 'village') as any;
        expect(result.debtCost).toBe(0);
      });

      it('enriches each result with the correct primaryTypeLabel', () => {
        // 'village' has type ['ACTION'] → label 'Action'
        const result = component.displaySearchResults().find((r) => r.cardKey === 'village') as any;
        expect(result.primaryTypeLabel).toBe('Action');
      });

      it('excludes basic cards when filterBasicCards input is true', () => {
        fixture.componentRef.setInput('filterBasicCards', true);
        fixture.detectChanges();
        const keys = component.displaySearchResults().map((r) => r.cardKey);
        expect(keys).not.toContain('gold');
        expect(keys).toContain('village');
      });
    });

    describe('when a card has a potion cost', () => {
      beforeEach(() => {
        selectableSearchCatalogStore.set(makeCatalog([
          makeCard({ cardKey: 'transmute', cost: { treasure: 0, potion: 1 } }),
        ]) as any);
        createComponent();
      });

      it('enriches results with the potion cost value', () => {
        expect((component.displaySearchResults()[0] as any).potionCost).toBe(1);
      });
    });

    describe('when a card has a debt cost', () => {
      beforeEach(() => {
        selectableSearchCatalogStore.set(makeCatalog([
          makeCard({ cardKey: 'engineers', cost: { treasure: 0, debt: 4 } }),
        ]) as any);
        createComponent();
      });

      it('enriches results with the debt cost value', () => {
        expect((component.displaySearchResults()[0] as any).debtCost).toBe(4);
      });
    });

    describe('imageSize input', () => {
      beforeEach(() => {
        selectableSearchCatalogStore.set(makeCatalog([makeCard()]) as any);
      });

      it('uses artImagePath when imageSize is "half"', () => {
        fixture = TestBed.createComponent(SelectCardLikeModalComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('catalogKind', 'cards');
        fixture.componentRef.setInput('imageSize', 'half');
        fixture.detectChanges();
        expect((component.displaySearchResults()[0] as any).imagePath).toBe('/img/village-art.jpg');
      });

      it('uses artImagePath when imageSize is "full"', () => {
        createComponent();
        expect((component.displaySearchResults()[0] as any).imagePath).toBe('/img/village-art.jpg');
      });
    });
  });

  // ── shouldShowNoResults ───────────────────────────────────────────────────

  describe('shouldShowNoResults', () => {
    beforeEach(() => {
      selectableSearchCatalogStore.set(makeCatalog([
        makeCard({ cardKey: 'village', cardName: 'Village', type: ['ACTION'] }),
      ]) as any);
      createComponent();
    });

    it('is false when no search term or type filter is active', () => {
      expect(component.shouldShowNoResults()).toBe(false);
    });

    describe('with debounced search', () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it('is true when a search term matches nothing', () => {
        component.updateSearchTerm('xyznotfound');
        jest.advanceTimersByTime(150);
        expect(component.shouldShowNoResults()).toBe(true);
      });

      it('is false when a search term matches at least one result', () => {
        component.updateSearchTerm('village');
        jest.advanceTimersByTime(150);
        expect(component.shouldShowNoResults()).toBe(false);
      });
    });

    it('is true when the active type filter matches nothing', () => {
      component.onTypeFilterClick('TREASURE'); // no treasure cards in this catalog
      expect(component.shouldShowNoResults()).toBe(true);
    });

    it('is false when the active type filter matches at least one result', () => {
      component.onTypeFilterClick('ACTION');
      expect(component.shouldShowNoResults()).toBe(false);
    });
  });

  // ── totalCount ────────────────────────────────────────────────────────────

  describe('totalCount', () => {
    it('returns the full catalog size regardless of active filters', () => {
      selectableSearchCatalogStore.set(makeCatalog([
        makeCard({ cardKey: 'village', type: ['ACTION'] }),
        makeCard({ cardKey: 'gold', type: ['TREASURE'] }),
      ]) as any);
      createComponent();
      component.onTypeFilterClick('TREASURE'); // only gold matches, but total is still 2
      expect(component.totalCount()).toBe(2);
    });
  });

  // ── Outputs ───────────────────────────────────────────────────────────────

  describe('outputs', () => {
    beforeEach(() => {
      selectableSearchCatalogStore.set(makeCatalog([
        makeCard({ cardKey: 'village' }),
        makeCard({ cardKey: 'smithy' }),
      ]) as any);
      createComponent();
    });

    it('onConfirm emits the full selected result objects', () => {
      const emitted: SelectableSearchResult[][] = [];
      component.confirmed.subscribe((items) => emitted.push(items));
      component.toggleCard('village');
      component.onConfirm();

      expect(emitted.length).toBe(1);
      expect(emitted[0][0].cardKey).toBe('village');
    });

    it('onConfirm emits all selected items even when some are hidden by the current search', () => {
      jest.useFakeTimers();
      const emitted: SelectableSearchResult[][] = [];
      component.confirmed.subscribe((items) => emitted.push(items));

      component.toggleCard('village');
      component.toggleCard('smithy');
      component.updateSearchTerm('smithy'); // only smithy visible after debounce
      jest.advanceTimersByTime(150);
      component.onConfirm();
      jest.useRealTimers();

      const confirmedKeys = emitted[0].map((r) => r.cardKey).sort();
      expect(confirmedKeys).toEqual(['smithy', 'village']);
    });

    it('onCancel emits the close event', () => {
      let closeFired = false;
      component.close.subscribe(() => { closeFired = true; });
      component.onCancel();
      expect(closeFired).toBe(true);
    });
  });

  // ── onContextMenu ─────────────────────────────────────────────────────────
  // Note: openCardDetailDialog is a module-level function; the Angular Jest
  // builder bundles sources before running tests, making jest.mock() path
  // resolution unreliable. Its invocation is covered by integration tests.
  // These unit tests verify the DOM event suppression behavior.

  describe('onContextMenu', () => {
    let event: MouseEvent;

    beforeEach(() => {
      createComponent();
      event = { preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as MouseEvent;
    });

    it('always prevents the native browser context menu', () => {
      component.onContextMenu(event, { detailImagePath: '/img/detail.jpg' } as any);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('prevents default even when detailImagePath is empty', () => {
      component.onContextMenu(event, { detailImagePath: '' } as any);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  // ── toTypeLabel ───────────────────────────────────────────────────────────

  describe('toTypeLabel', () => {
    beforeEach(() => createComponent());

    it('title-cases an uppercase type string', () => {
      expect(component.toTypeLabel('ACTION')).toBe('Action');
      expect(component.toTypeLabel('DURATION')).toBe('Duration');
      expect(component.toTypeLabel('TREASURE')).toBe('Treasure');
    });

    it('handles a single-character string', () => {
      expect(component.toTypeLabel('A')).toBe('A');
    });
  });
});
