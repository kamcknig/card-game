import { assertEquals } from '@std/assert';
import { getAvailableKingdomRandomizerGroups } from '../get-available-kingdom-randomizer-groups.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { createTestExpansionData } from '../../testing/create-test-expansion-data.ts';

Deno.test('getAvailableKingdomRandomizerGroups excludes banned/excluded and non-selectable cards', () => {
  const village = createTestCard({ cardKey: 'village' });
  const smithy = createTestCard({ cardKey: 'smithy' });
  const castlePart = createTestCard({
    cardKey: 'castle-part-a',
    randomizerData: { randomizer: 'castles' },
  });
  const nonSelectable = createTestCard({ cardKey: 'secret-card', kingdomSelectable: false });

  const expansion = createTestExpansionData({
    name: 'expansion-a',
    kingdomSupply: {
      village,
      smithy,
      'castle-part-a': castlePart,
      'secret-card': nonSelectable,
    },
  });

  const groups = getAvailableKingdomRandomizerGroups({
    expansions: [expansion],
    bannedPileKeys: ['village'],
    excludedPileKeys: ['castles'],
  });

  assertEquals(groups.map(group => group.pileKey), ['smithy']);
  assertEquals(groups[0].cards.map(card => card.cardKey), ['smithy']);
});

Deno.test('getAvailableKingdomRandomizerGroups deduplicates repeated card keys in one pile', () => {
  const sharedVillageCard = createTestCard({ cardKey: 'village' });

  const expansionA = createTestExpansionData({
    name: 'expansion-a',
    kingdomSupply: { village: sharedVillageCard },
  });

  const expansionB = createTestExpansionData({
    name: 'expansion-b',
    kingdomSupply: {
      village: createTestCard({ cardKey: 'village' }),
      market: createTestCard({ cardKey: 'market' }),
    },
  });

  const groups = getAvailableKingdomRandomizerGroups({
    expansions: [expansionA, expansionB],
  });

  const villageGroup = groups.find(group => group.pileKey === 'village');
  const marketGroup = groups.find(group => group.pileKey === 'market');

  assertEquals(villageGroup?.cards.map(card => card.cardKey), ['village']);
  assertEquals(marketGroup?.cards.map(card => card.cardKey), ['market']);
});

Deno.test('getAvailableKingdomRandomizerGroups applies cardFilter before grouping', () => {
  const expansion = createTestExpansionData({
    name: 'expansion-a',
    kingdomSupply: {
      silverMine: createTestCard({ cardKey: 'silver-mine', cost: { treasure: 5 } }),
      workshop: createTestCard({ cardKey: 'workshop', cost: { treasure: 3 } }),
    },
  });

  const groups = getAvailableKingdomRandomizerGroups({
    expansions: [expansion],
    cardFilter: card => card.cost.treasure <= 3,
  });

  assertEquals(groups.map(group => group.pileKey), ['workshop']);
});
