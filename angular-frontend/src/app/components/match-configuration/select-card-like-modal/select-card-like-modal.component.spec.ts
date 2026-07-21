import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NanostoresService } from '@nanostores/angular';
import { of } from 'rxjs';

import { selectableSearchCatalogStore } from '../../../state/selectable-search-state';
import { selfPlayerIdStore } from '../../../state/player-state';
import { SocketService } from '../../../core/socket-service/socket.service';
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

/**
 * Stubs SocketService: records emits and registered server-event handlers so
 * tests can simulate server search responses via trigger().
 */
class SocketServiceStub {
  private readonly _handlers = new Map<string, (...args: unknown[]) => void>();
  on = jest.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
    this._handlers.set(event, handler);
  });
  off = jest.fn().mockImplementation((event: string) => {
    this._handlers.delete(event);
  });
  emit = jest.fn();

  /** Test helper: fires a previously-registered server event handler. */
  trigger(event: string, ...args: unknown[]): void {
    this._handlers.get(event)?.(...args);
  }
}

describe('SelectCardLikeModalComponent', () => {
  let component: SelectCardLikeModalComponent;
  let fixture: ComponentFixture<SelectCardLikeModalComponent>;
  let socket: SocketServiceStub;

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
        provideZonelessChangeDetection(),
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: SocketService, useClass: SocketServiceStub },
      ],
    })
      // Add NO_ERRORS_SCHEMA directly to the standalone component so unknown
      // child elements (<app-card>, <app-card-like>) are tolerated without
      // bringing in their full dependency graph; standalone components ignore
      // the TestBed-level schema.
      .overrideComponent(SelectCardLikeModalComponent, {
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    socket = TestBed.inject(SocketService) as unknown as SocketServiceStub;
  });

  afterEach(() => {
    selfPlayerIdStore.set(undefined);
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

      // Matching is server-authoritative: a non-empty debounced term emits a
      // search<Kind> socket request and the grid renders whatever the server
      // sends back on search<Kind>Response (fuzzy matching lives in
      // server/src/core/expansion-search-service.ts, not the client).
      describe('debounced search term filtering (server-driven)', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        it('requests server results for the debounced term', () => {
          // The NanostoresService stub snapshots store values at component
          // creation, so the player id must be set before re-creating.
          selfPlayerIdStore.set(7);
          createComponent();
          component.updateSearchTerm('village');
          jest.advanceTimersByTime(150);
          // Zoneless: flush the request effect explicitly after the debounce.
          TestBed.tick();
          expect(socket.emit).toHaveBeenCalledWith('searchCards', 7, 'village');
        });

        it('renders the server search response for a non-empty term', () => {
          component.updateSearchTerm('village');
          jest.advanceTimersByTime(150);
          socket.trigger('searchCardResponse', [village]);
          expect(component.displaySearchResults().map((r) => r.cardKey)).toEqual(['village']);
        });

        it('returns no results when the server responds with none', () => {
          component.updateSearchTerm('xyznotfound');
          jest.advanceTimersByTime(150);
          socket.trigger('searchCardResponse', []);
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

      it('excludes basic cards when filterBasicCards input is true', () => {
        fixture.componentRef.setInput('filterBasicCards', true);
        fixture.detectChanges();
        const keys = component.displaySearchResults().map((r) => r.cardKey);
        expect(keys).not.toContain('gold');
        expect(keys).toContain('village');
      });
    });
  });

  // ── Narrowed display lists used by the template ───────────────────────────
  // The modal template iterates `displayCardResults()` for the half/cards
  // branch and `displayCardLikeResults()` for the full/landscape branch so
  // <app-card> / <app-card-like> get a properly narrowed type without a
  // template-level cast.

  describe('displayCardResults / displayCardLikeResults', () => {
    beforeEach(() => {
      selectableSearchCatalogStore.set(makeCatalog([makeCard({ cardKey: 'village' })]) as any);
    });

    it('populates displayCardResults only when imageSize is "half"', () => {
      fixture = TestBed.createComponent(SelectCardLikeModalComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('catalogKind', 'cards');
      fixture.componentRef.setInput('imageSize', 'half');
      fixture.detectChanges();

      expect(component.displayCardResults().length).toBe(1);
      expect(component.displayCardLikeResults().length).toBe(0);
    });

    it('populates displayCardLikeResults only when imageSize is "full"', () => {
      // Cardlike catalog populated for the events kind.
      selectableSearchCatalogStore.set(makeCatalog([], [makeEvent()]) as any);
      fixture = TestBed.createComponent(SelectCardLikeModalComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('catalogKind', 'events');
      fixture.componentRef.setInput('imageSize', 'full');
      fixture.detectChanges();

      expect(component.displayCardLikeResults().length).toBe(1);
      expect(component.displayCardResults().length).toBe(0);
    });
  });

  // ── cardLikeKind / cardLikeShowCost (drive <app-card-like> inputs) ────────

  describe('cardLikeKind', () => {
    it('returns undefined for the cards catalog (which renders via <app-card>)', () => {
      createComponent('cards');
      expect(component.cardLikeKind()).toBeUndefined();
    });

    it('maps each landscape catalog kind to its CardLikeKind', () => {
      const cases: Array<[string, string]> = [
        ['events', 'event'],
        ['landmarks', 'landmark'],
        ['artifacts', 'artifact'],
        ['projects', 'project'],
        ['ways', 'way'],
        ['traits', 'trait'],
        ['allies', 'ally'],
        ['prophecies', 'prophecy'],
      ];
      for (const [catalogKind, expectedCardLikeKind] of cases) {
        createComponent(catalogKind);
        expect(component.cardLikeKind()).toBe(expectedCardLikeKind);
      }
    });
  });

  describe('cardLikeShowCost', () => {
    it('is true for events and projects (which carry costs)', () => {
      createComponent('events');
      expect(component.cardLikeShowCost()).toBe(true);
      createComponent('projects');
      expect(component.cardLikeShowCost()).toBe(true);
    });

    it('is false for catalogs whose entries have no printed cost', () => {
      const noCostKinds = ['cards', 'landmarks', 'ways', 'traits', 'allies', 'prophecies'];
      for (const kind of noCostKinds) {
        createComponent(kind);
        expect(component.cardLikeShowCost()).toBe(false);
      }
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

      it('is true when the server returns no results for the term', () => {
        component.updateSearchTerm('xyznotfound');
        jest.advanceTimersByTime(150);
        socket.trigger('searchCardResponse', []);
        expect(component.shouldShowNoResults()).toBe(true);
      });

      it('is false when the server returns at least one result', () => {
        component.updateSearchTerm('village');
        jest.advanceTimersByTime(150);
        socket.trigger('searchCardResponse', [
          makeCard({ cardKey: 'village', cardName: 'Village', type: ['ACTION'] }),
        ]);
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

  // Right-click → detail dialog is now handled by the inner <app-card> /
  // <app-card-like> components themselves (they call event.stopPropagation),
  // so the modal no longer owns its own onContextMenu method. Verified by the
  // CardComponent / CardLikeComponent unit tests.

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
