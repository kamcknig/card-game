import { assertEquals } from '@std/assert';
import { ExpansionSearchService } from '../expansion-search-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';

// Builds an ExpansionSearchService with a primed ExpansionCatalogService.
// Adding cards via setRawCard mirrors how ExpansionLoaderService populates the
// catalog at startup; rebuildIndexes() then materialises the searchable form.
const buildService = (cards: { key: string; data: ReturnType<typeof createTestCard> }[]) => {
  const expansionCatalogService = new ExpansionCatalogService();
  for (const { key, data } of cards) {
    expansionCatalogService.setRawCard(key, data);
  }
  const { loggerService } = createTestLogger();
  const service = new ExpansionSearchService(expansionCatalogService, loggerService);
  return service;
};

Deno.test('ExpansionSearchService catalog includes single-card kingdoms unchanged', () => {
  const village = createTestCard({ cardKey: 'village', cardName: 'Village' });
  const smithy = createTestCard({ cardKey: 'smithy', cardName: 'Smithy' });
  const service = buildService([
    { key: 'village', data: village },
    { key: 'smithy', data: smithy },
  ]);

  const catalog = service.getSelectableSearchCatalog();
  const cardKeys = catalog.cards.map(card => card.cardKey).sort();
  assertEquals(cardKeys, ['smithy', 'village']);
  // No randomizerData → no imageKeyOverride; cardName preserved.
  const villageEntry = catalog.cards.find(card => card.cardKey === 'village');
  assertEquals(villageEntry?.imageKeyOverride, undefined);
  assertEquals(villageEntry?.cardName, 'Village');
});

Deno.test('ExpansionSearchService collapses multi-card piles to a single representative', () => {
  // Three Castles members sharing the same randomizer ('castles').
  const humbleCastle = createTestCard({
    cardKey: 'humble-castle',
    cardName: 'Humble Castle',
    cost: { treasure: 3 },
    type: ['VICTORY'],
    randomizerData: { randomizer: 'castles', cost: { treasure: 3 }, type: ['VICTORY', 'CASTLE'] },
  });
  const sprawlingCastle = createTestCard({
    cardKey: 'sprawling-castle',
    cardName: 'Sprawling Castle',
    cost: { treasure: 8 },
    type: ['VICTORY'],
    randomizerData: { randomizer: 'castles', cost: { treasure: 3 }, type: ['VICTORY', 'CASTLE'] },
  });
  const kingsCastle = createTestCard({
    cardKey: 'kings-castle',
    cardName: "King's Castle",
    cost: { treasure: 10 },
    type: ['VICTORY'],
    randomizerData: { randomizer: 'castles', cost: { treasure: 3 }, type: ['VICTORY', 'CASTLE'] },
  });
  const service = buildService([
    { key: 'humble-castle', data: humbleCastle },
    { key: 'sprawling-castle', data: sprawlingCastle },
    { key: 'kings-castle', data: kingsCastle },
  ]);

  const catalog = service.getSelectableSearchCatalog();
  // Three pile members → one catalog entry.
  assertEquals(catalog.cards.length, 1);
  const rep = catalog.cards[0];
  // Pile-level cost and type from randomizerData win over the member's own.
  assertEquals(rep.cost, { treasure: 3 });
  assertEquals(rep.type, ['VICTORY', 'CASTLE']);
});

Deno.test('ExpansionSearchService sets imageKeyOverride from randomizer key', () => {
  const member = createTestCard({
    cardKey: 'humble-castle',
    cardName: 'Humble Castle',
    randomizerData: { randomizer: 'castles' },
  });
  const service = buildService([{ key: 'humble-castle', data: member }]);

  const catalog = service.getSelectableSearchCatalog();
  assertEquals(catalog.cards[0].imageKeyOverride, 'castles');
});

Deno.test('ExpansionSearchService converts slashes in randomizer key to hyphens for image override', () => {
  // Empires-style split-pile members share a slash-keyed randomizer.
  const catapult = createTestCard({
    cardKey: 'catapult',
    cardName: 'Catapult',
    randomizerData: { randomizer: 'catapult/rocks' },
  });
  const rocks = createTestCard({
    cardKey: 'rocks',
    cardName: 'Rocks',
    randomizerData: { randomizer: 'catapult/rocks' },
  });
  const service = buildService([
    { key: 'catapult', data: catapult },
    { key: 'rocks', data: rocks },
  ]);

  const catalog = service.getSelectableSearchCatalog();
  assertEquals(catalog.cards.length, 1);
  // Slash → hyphen so the image filename is filesystem-safe.
  assertEquals(catalog.cards[0].imageKeyOverride, 'catapult-rocks');
});

Deno.test('ExpansionSearchService derives pile cardName from randomizer with slashes preserved', () => {
  const catapult = createTestCard({
    cardKey: 'catapult',
    cardName: 'Catapult',
    randomizerData: { randomizer: 'catapult/rocks' },
  });
  const service = buildService([{ key: 'catapult', data: catapult }]);

  const catalog = service.getSelectableSearchCatalog();
  // Each side title-cased, slash preserved with surrounding spaces.
  assertEquals(catalog.cards[0].cardName, 'Catapult / Rocks');
});

Deno.test('ExpansionSearchService title-cases hyphenated segments inside a slash side', () => {
  const settlers = createTestCard({
    cardKey: 'settlers',
    cardName: 'Settlers',
    randomizerData: { randomizer: 'settlers/bustling-village' },
  });
  const service = buildService([{ key: 'settlers', data: settlers }]);

  const catalog = service.getSelectableSearchCatalog();
  // 'settlers/bustling-village' → 'Settlers / Bustling Village' (hyphens within
  // a side become spaces, each word capitalised, slash preserved).
  assertEquals(catalog.cards[0].cardName, 'Settlers / Bustling Village');
});

Deno.test('ExpansionSearchService title-cases single-segment randomizer (no slash)', () => {
  // 'knights' → 'Knights' — no slash, single word.
  const dameAnna = createTestCard({
    cardKey: 'dame-anna',
    cardName: 'Dame Anna',
    randomizerData: { randomizer: 'knights' },
  });
  const service = buildService([{ key: 'dame-anna', data: dameAnna }]);

  const catalog = service.getSelectableSearchCatalog();
  assertEquals(catalog.cards[0].cardName, 'Knights');
  assertEquals(catalog.cards[0].imageKeyOverride, 'knights');
});

Deno.test('ExpansionSearchService does not set imageKeyOverride for cards without randomizerData', () => {
  const village = createTestCard({ cardKey: 'village', cardName: 'Village' });
  const service = buildService([{ key: 'village', data: village }]);

  const catalog = service.getSelectableSearchCatalog();
  assertEquals(catalog.cards[0].imageKeyOverride, undefined);
  // cardName untouched — no randomizer to derive from.
  assertEquals(catalog.cards[0].cardName, 'Village');
});

Deno.test('ExpansionSearchService excludes basic cards from the catalog', () => {
  const copper = createTestCard({ cardKey: 'copper', cardName: 'Copper', isBasic: true });
  const village = createTestCard({ cardKey: 'village', cardName: 'Village' });
  const service = buildService([
    { key: 'copper', data: copper },
    { key: 'village', data: village },
  ]);

  const catalog = service.getSelectableSearchCatalog();
  const keys = catalog.cards.map(card => card.cardKey);
  assertEquals(keys.includes('copper'), false);
  assertEquals(keys.includes('village'), true);
});

Deno.test('ExpansionSearchService excludes cards with kingdomSelectable=false', () => {
  const ruinedLibrary = createTestCard({
    cardKey: 'ruined-library',
    cardName: 'Ruined Library',
    kingdomSelectable: false,
  });
  const village = createTestCard({ cardKey: 'village', cardName: 'Village' });
  const service = buildService([
    { key: 'ruined-library', data: ruinedLibrary },
    { key: 'village', data: village },
  ]);

  const catalog = service.getSelectableSearchCatalog();
  const keys = catalog.cards.map(card => card.cardKey);
  assertEquals(keys.includes('ruined-library'), false);
  assertEquals(keys.includes('village'), true);
});

Deno.test('ExpansionSearchService searchKingdomCards returns the deduped pile entry, not members', () => {
  const dameAnna = createTestCard({
    cardKey: 'dame-anna',
    cardName: 'Dame Anna',
    randomizerData: { randomizer: 'knights' },
  });
  const sirBailey = createTestCard({
    cardKey: 'sir-bailey',
    cardName: 'Sir Bailey',
    randomizerData: { randomizer: 'knights' },
  });
  const service = buildService([
    { key: 'dame-anna', data: dameAnna },
    { key: 'sir-bailey', data: sirBailey },
  ]);

  // Empty search string returns the full catalog (deduped).
  const results = service.searchKingdomCards('');
  assertEquals(results.length, 1);
  assertEquals(results[0].cardName, 'Knights');
});
