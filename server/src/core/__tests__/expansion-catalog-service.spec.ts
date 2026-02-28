import { assertEquals, assertThrows } from '@std/assert';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { createTestExpansionData } from '../../testing/create-test-expansion-data.ts';

Deno.test('ExpansionCatalogService stores and retrieves expansion metadata', () => {
  const expansionCatalogService = new ExpansionCatalogService();
  const expansionData = createTestExpansionData({ name: 'test-expansion' });

  expansionCatalogService.setExpansion('test-expansion', expansionData);

  assertEquals(expansionCatalogService.hasExpansion('test-expansion'), true);
  assertEquals(expansionCatalogService.getExpansion('test-expansion'), expansionData);
  assertEquals(expansionCatalogService.getRequiredExpansion('test-expansion'), expansionData);
});

Deno.test('ExpansionCatalogService throws when required expansion is missing', () => {
  const expansionCatalogService = new ExpansionCatalogService();

  assertThrows(
    () => expansionCatalogService.getRequiredExpansion('missing-expansion'),
    Error,
    'expansion missing-expansion not loaded',
  );
});

Deno.test('ExpansionCatalogService removes stored expansions', () => {
  const expansionCatalogService = new ExpansionCatalogService();
  expansionCatalogService.setExpansion('test-expansion', createTestExpansionData({ name: 'test-expansion' }));

  expansionCatalogService.removeExpansion('test-expansion');

  assertEquals(expansionCatalogService.hasExpansion('test-expansion'), false);
  assertEquals(expansionCatalogService.getExpansion('test-expansion'), undefined);
});

Deno.test('ExpansionCatalogService stores and retrieves raw card templates', () => {
  const expansionCatalogService = new ExpansionCatalogService();
  const card = createTestCard({ cardKey: 'workshop' });

  expansionCatalogService.setRawCard('workshop', card);

  assertEquals(expansionCatalogService.getRawCard('workshop'), card);
  assertEquals(expansionCatalogService.getRawCardLibrary().workshop, card);
});
