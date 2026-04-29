import { assertEquals } from '@std/assert';
import { createCardData, createCardLike } from '../create-card-data.ts';

Deno.test('createCardLike derives display name and image paths from key/expansion', () => {
  const cardLike = createCardLike('haunted-woods', 'adventures', {});

  assertEquals(cardLike.cardName, 'Haunted Woods');
  assertEquals(cardLike.fullImagePath, './assets/card-images/adventures/full-size/haunted-woods.jpg');
  assertEquals(cardLike.detailImagePath, './assets/card-images/adventures/detail/haunted-woods.jpg');
  assertEquals((cardLike as unknown as { kingdom: string }).kingdom, 'haunted-woods');
});

Deno.test('createCardLike prefers randomizer key as default kingdom when provided', () => {
  const cardLike = createCardLike('ruined-village', 'dark-ages', {
    randomizerData: { randomizer: 'ruins' },
  });

  assertEquals((cardLike as unknown as { kingdom: string }).kingdom, 'ruins');
});

Deno.test('createCardData adds flat art/detail image paths and preserves explicit overrides', () => {
  const card = createCardData('village', 'base-v2', {
    cardName: 'Village+',
    kingdom: 'custom-pile',
  });

  assertEquals(card.cardName, 'Village+');
  assertEquals(card.kingdom, 'custom-pile');
  // Cards use the flat asset layout; artImagePath replaces the legacy halfImagePath.
  assertEquals(card.artImagePath, './assets/card-images/base-v2/village-art.jpg');
  // detailImagePath is overridden to the flat path for cards.
  assertEquals(card.detailImagePath, './assets/card-images/base-v2/village-detail.jpg');
  // fullImagePath is still inherited from createCardLike (legacy sub-directory).
  assertEquals(card.fullImagePath, './assets/card-images/base-v2/full-size/village.jpg');
});

Deno.test('createCardData defaults kingdom to cardKey when no explicit kingdom or randomizer', () => {
  const card = createCardData('smithy', 'base-v2', {});

  assertEquals(card.kingdom, 'smithy');
});

Deno.test('createCardData defaults kingdom to cardKey ignoring randomizerData randomizer', () => {
  // createCardData uses templateData.kingdom ?? cardKey for the kingdom field,
  // so randomizerData.randomizer does not affect the card-level kingdom.
  const card = createCardData('encampment', 'empires', {
    randomizerData: { randomizer: 'encampment-plunder' },
  });

  assertEquals(card.kingdom, 'encampment');
});

Deno.test('createCardLike uses explicit kingdom over randomizer', () => {
  const cardLike = createCardLike('ruined-library', 'dark-ages', {
    randomizerData: { randomizer: 'ruins' },
    kingdom: 'explicit-kingdom',
  });

  assertEquals((cardLike as unknown as { kingdom: string }).kingdom, 'explicit-kingdom');
});

Deno.test('createCardLike defaults cardName from formatted card key', () => {
  const cardLike = createCardLike('haunted-woods', 'adventures', {});

  assertEquals(cardLike.cardName, 'Haunted Woods');
});

Deno.test('createCardLike falls back to cardKey as kingdom when randomizerData randomizer is undefined', () => {
  const cardLike = createCardLike('patrol', 'intrigue', {
    randomizerData: { randomizer: undefined } as unknown as { randomizer: string },
  });

  assertEquals((cardLike as unknown as { kingdom: string }).kingdom, 'patrol');
});
