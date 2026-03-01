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

Deno.test('createCardData adds half image path and preserves explicit overrides', () => {
  const card = createCardData('village', 'base-v2', {
    cardName: 'Village+',
    kingdom: 'custom-pile',
  });

  assertEquals(card.cardName, 'Village+');
  assertEquals(card.kingdom, 'custom-pile');
  assertEquals(card.halfImagePath, './assets/card-images/base-v2/half-size/village.jpg');
  assertEquals(card.fullImagePath, './assets/card-images/base-v2/full-size/village.jpg');
});
