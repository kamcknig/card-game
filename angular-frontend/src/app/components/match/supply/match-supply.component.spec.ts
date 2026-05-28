import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NanostoresService } from '@nanostores/angular';
import { atom } from 'nanostores';
import { of } from 'rxjs';
import { Card, CardId } from 'shared/types';

import { cardStore } from '../../../state/card-state';
import { basicSupplies, kingdomSupplies } from '../../../state/match-logic';
import { cardSourceStore } from '../../../state/card-source-store';
import { MatchSupplyComponent } from './match-supply.component';

/**
 * Minimal card factory — only the fields inspected by sortKeysByCostDescending
 * and buildPileModel need to be populated.
 */
function makeCard(fields: { id: CardId; cardKey: string; cardName?: string; kingdom?: string; cost: { treasure: number }; type?: string[]; partOfSupply?: boolean }): Card {
  return {
    id: fields.id,
    cardKey: fields.cardKey,
    kingdom: fields.kingdom ?? fields.cardKey,
    cardName: fields.cardName ?? fields.cardKey,
    cost: fields.cost,
    type: fields.type ?? [],
    partOfSupply: fields.partOfSupply ?? true,
  } as unknown as Card;
}

describe('MatchSupplyComponent — supply ordering', () => {
  let component: MatchSupplyComponent;
  let fixture: ComponentFixture<MatchSupplyComponent>;

  beforeEach(async () => {
    // Reset shared nanostores atoms before each test so state does not bleed
    // across tests in the same suite.
    cardStore.set({});
    basicSupplies.set([[], []]);
    kingdomSupplies.set([]);
    cardSourceStore.set({});

    await TestBed.configureTestingModule({
      imports: [MatchSupplyComponent],
      providers: [
        provideZonelessChangeDetection(),
        // Stub NanostoresService so toSignal() resolves against the real store
        // atoms' initial values without needing the full Angular DI chain.
        {
          provide: NanostoresService,
          useValue: {
            useStore: jest.fn().mockImplementation((store: { get(): unknown }) => of(store.get())),
            ngOnDestroy: () => {},
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  /**
   * Seeds stores and creates a fresh component fixture. Called at the start
   * of each test after the stores have been populated with test data.
   */
  const createFixture = (): void => {
    fixture = TestBed.createComponent(MatchSupplyComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('area', 'basic');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  };

  describe('basicVictoryPiles ordering', () => {
    it('renders victory piles from highest to lowest cost', () => {
      // Province (8), Duchy (5), Estate (2) — deliberately seeded out of order
      // so the test would fail without the sort.
      const province = makeCard({ id: 1, cardKey: 'province', cardName: 'Province', cost: { treasure: 8 }, type: ['VICTORY'] });
      const duchy = makeCard({ id: 2, cardKey: 'duchy', cardName: 'Duchy', cost: { treasure: 5 }, type: ['VICTORY'] });
      const estate = makeCard({ id: 3, cardKey: 'estate', cardName: 'Estate', cost: { treasure: 2 }, type: ['VICTORY'] });

      cardStore.set({ 1: province, 2: duchy, 3: estate });
      // Seed in wrong order: estate first, then province, then duchy.
      basicSupplies.set([['estate', 'province', 'duchy'], []]);
      cardSourceStore.set({ basicSupply: [3, 1, 2] });

      createFixture();

      const keys = component.basicVictoryPiles().map((p) => p.sourceKey);
      expect(keys).toEqual(['province', 'duchy', 'estate']);
    });

    it('places Colony above Province when Prosperity is in the game', () => {
      const colony = makeCard({ id: 1, cardKey: 'colony', cardName: 'Colony', cost: { treasure: 11 }, type: ['VICTORY'] });
      const province = makeCard({ id: 2, cardKey: 'province', cardName: 'Province', cost: { treasure: 8 }, type: ['VICTORY'] });
      const duchy = makeCard({ id: 3, cardKey: 'duchy', cardName: 'Duchy', cost: { treasure: 5 }, type: ['VICTORY'] });
      const estate = makeCard({ id: 4, cardKey: 'estate', cardName: 'Estate', cost: { treasure: 2 }, type: ['VICTORY'] });

      cardStore.set({ 1: colony, 2: province, 3: duchy, 4: estate });
      // Simulate server order where Colony is appended last by the Prosperity
      // configurator — this is the broken order the sort must fix.
      basicSupplies.set([['province', 'duchy', 'estate', 'colony'], []]);
      cardSourceStore.set({ basicSupply: [2, 3, 4, 1] });

      createFixture();

      const keys = component.basicVictoryPiles().map((p) => p.sourceKey);
      expect(keys).toEqual(['colony', 'province', 'duchy', 'estate']);
    });

    it('excludes Curse from the victory pile list', () => {
      const province = makeCard({ id: 1, cardKey: 'province', cardName: 'Province', cost: { treasure: 8 }, type: ['VICTORY'] });
      const curse = makeCard({ id: 2, cardKey: 'curse', cardName: 'Curse', cost: { treasure: 0 }, type: ['VICTORY', 'CURSE'] });

      cardStore.set({ 1: province, 2: curse });
      basicSupplies.set([['province', 'curse'], []]);
      cardSourceStore.set({ basicSupply: [1, 2] });

      createFixture();

      const keys = component.basicVictoryPiles().map((p) => p.sourceKey);
      expect(keys).not.toContain('curse');
      expect(keys).toContain('province');
    });
  });

  describe('basicTreasurePiles ordering', () => {
    it('renders treasure piles from highest to lowest cost', () => {
      const gold = makeCard({ id: 1, cardKey: 'gold', cardName: 'Gold', cost: { treasure: 6 }, type: ['TREASURE'] });
      const silver = makeCard({ id: 2, cardKey: 'silver', cardName: 'Silver', cost: { treasure: 3 }, type: ['TREASURE'] });
      const copper = makeCard({ id: 3, cardKey: 'copper', cardName: 'Copper', cost: { treasure: 0 }, type: ['TREASURE'] });

      cardStore.set({ 1: gold, 2: silver, 3: copper });
      // Seed in wrong order.
      basicSupplies.set([[], ['copper', 'gold', 'silver']]);
      cardSourceStore.set({ basicSupply: [3, 1, 2] });

      createFixture();

      const keys = component.basicTreasurePiles().map((p) => p.sourceKey);
      expect(keys).toEqual(['gold', 'silver', 'copper']);
    });

    it('places Platinum above Gold when Prosperity is in the game', () => {
      const platinum = makeCard({ id: 1, cardKey: 'platinum', cardName: 'Platinum', cost: { treasure: 9 }, type: ['TREASURE'] });
      const gold = makeCard({ id: 2, cardKey: 'gold', cardName: 'Gold', cost: { treasure: 6 }, type: ['TREASURE'] });
      const silver = makeCard({ id: 3, cardKey: 'silver', cardName: 'Silver', cost: { treasure: 3 }, type: ['TREASURE'] });
      const copper = makeCard({ id: 4, cardKey: 'copper', cardName: 'Copper', cost: { treasure: 0 }, type: ['TREASURE'] });

      cardStore.set({ 1: platinum, 2: gold, 3: silver, 4: copper });
      // Simulate server order where Platinum is appended last.
      basicSupplies.set([[], ['gold', 'silver', 'copper', 'platinum']]);
      cardSourceStore.set({ basicSupply: [2, 3, 4, 1] });

      createFixture();

      const keys = component.basicTreasurePiles().map((p) => p.sourceKey);
      expect(keys).toEqual(['platinum', 'gold', 'silver', 'copper']);
    });
  });

  describe('kingdomPiles ordering', () => {
    it('renders kingdom piles from highest to lowest treasure cost', () => {
      const market = makeCard({ id: 1, cardKey: 'market', cardName: 'Market', cost: { treasure: 5 }, type: ['ACTION'] });
      const village = makeCard({ id: 2, cardKey: 'village', cardName: 'Village', cost: { treasure: 3 }, type: ['ACTION'] });
      const cellar = makeCard({ id: 3, cardKey: 'cellar', cardName: 'Cellar', cost: { treasure: 2 }, type: ['ACTION'] });

      cardStore.set({ 1: market, 2: village, 3: cellar });
      kingdomSupplies.set(['cellar', 'market', 'village']);
      cardSourceStore.set({ kingdomSupply: [3, 1, 2] });

      fixture = TestBed.createComponent(MatchSupplyComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('area', 'kingdom');
      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();

      const keys = component.kingdomPiles().map((p) => p.sourceKey);
      expect(keys).toEqual(['market', 'village', 'cellar']);
    });

    it('breaks cost ties by card name descending', () => {
      // Both cards cost 4; name order descending: Witch before Smithy.
      const smithy = makeCard({ id: 1, cardKey: 'smithy', cardName: 'Smithy', cost: { treasure: 4 }, type: ['ACTION'] });
      const witch = makeCard({ id: 2, cardKey: 'witch', cardName: 'Witch', cost: { treasure: 4 }, type: ['ACTION'] });

      cardStore.set({ 1: smithy, 2: witch });
      kingdomSupplies.set(['smithy', 'witch']);
      cardSourceStore.set({ kingdomSupply: [1, 2] });

      fixture = TestBed.createComponent(MatchSupplyComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('area', 'kingdom');
      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();

      const keys = component.kingdomPiles().map((p) => p.sourceKey);
      expect(keys).toEqual(['witch', 'smithy']);
    });
  });
});
