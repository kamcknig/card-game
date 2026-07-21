import { assertEquals } from '@std/assert';
import type { CardNoId, ComputedMatchConfiguration, Supply } from 'shared/types/index.ts';
import type { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { configurePortPile } from '../configure-port-pile.ts';

// Builds a homogeneous single-card Supply pile of the given size.
const createSupply = (cardKey: string, count: number): Supply => {
  const card = { cardKey, type: ['ACTION'] } as unknown as CardNoId;
  return { name: cardKey, cards: new Array(count).fill(card) };
};

// Builds a minimal ExpansionConfiguratorContext stub for configurePortPile.
const createContext = (kingdomSupply: Supply[]) =>
  ({
    config: { kingdomSupply } as unknown as ComputedMatchConfiguration,
    loggerService: { debug: () => {}, info: () => {} },
  }) as unknown as ExpansionConfiguratorContext;

Deno.test('configurePortPile pads a 10-card port pile to 12 copies', () => {
  const args = createContext([createSupply('port', 10)]);
  configurePortPile(args);
  assertEquals(args.config.kingdomSupply[0].cards.length, 12);
});

Deno.test('configurePortPile is idempotent on re-run', () => {
  const args = createContext([createSupply('port', 10)]);
  configurePortPile(args);
  configurePortPile(args);
  assertEquals(args.config.kingdomSupply[0].cards.length, 12);
});

Deno.test('configurePortPile leaves non-port piles untouched', () => {
  const args = createContext([createSupply('village', 10)]);
  configurePortPile(args);
  assertEquals(args.config.kingdomSupply[0].cards.length, 10);
});
