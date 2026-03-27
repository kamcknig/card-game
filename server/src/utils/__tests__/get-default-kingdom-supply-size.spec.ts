import { assertEquals } from '@std/assert';
import { getDefaultKingdomSupplySize } from '../get-default-kingdom-supply-size.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { createTestMatchConfiguration } from '../../testing/create-test-match-configuration.ts';
import { createTestPlayer } from '../../testing/create-test-player.ts';

Deno.test('getDefaultKingdomSupplySize uses 8 for victory cards in 2-player games', () => {
  const matchConfiguration = createTestMatchConfiguration({
    players: [createTestPlayer({ id: 1 }), createTestPlayer({ id: 2 })],
  });

  const result = getDefaultKingdomSupplySize(createTestCard({ type: ['VICTORY'] }), matchConfiguration);

  assertEquals(result, 8);
});

Deno.test('getDefaultKingdomSupplySize uses 12 for victory cards in 3+ player games', () => {
  const matchConfiguration = createTestMatchConfiguration({
    players: [createTestPlayer({ id: 1 }), createTestPlayer({ id: 2 }), createTestPlayer({ id: 3 })],
  });

  const result = getDefaultKingdomSupplySize(createTestCard({ type: ['VICTORY'] }), matchConfiguration);

  assertEquals(result, 12);
});

Deno.test('getDefaultKingdomSupplySize uses 10 for non-victory cards', () => {
  const matchConfiguration = createTestMatchConfiguration();

  const result = getDefaultKingdomSupplySize(createTestCard({ type: ['ACTION'] }), matchConfiguration);

  assertEquals(result, 10);
});
