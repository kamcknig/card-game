import { assertEquals, assertNotStrictEquals, assertStrictEquals } from '@std/assert';
import type { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { configureSplitPile } from '../configure-split-pile.ts';

// Builds the minimum configurator context required by configureSplitPile tests.
const createContext = (args: {
  kingdomSupply: Array<{ name: string; cards: ReturnType<typeof createTestCard>[] }>;
  cardLibrary: Record<string, ReturnType<typeof createTestCard>>;
}) => {
  const infoLogs: unknown[][] = [];
  const warnLogs: unknown[][] = [];
  const logLogs: unknown[][] = [];

  const context = {
    config: {
      kingdomSupply: args.kingdomSupply,
    },
    cardLibrary: args.cardLibrary,
    loggerService: {
      info: (...items: unknown[]) => infoLogs.push(items),
      warn: (...items: unknown[]) => warnLogs.push(items),
      log: (...items: unknown[]) => logLogs.push(items),
    },
  } as unknown as ExpansionConfiguratorContext;

  return {
    context,
    infoLogs,
    warnLogs,
    logLogs,
  };
};

Deno.test('configureSplitPile logs and exits when target pile is not present', () => {
  const { context, infoLogs } = createContext({ kingdomSupply: [], cardLibrary: {} });

  configureSplitPile(context, {
    pileKey: 'castles',
    desiredOrder: ['small-castle', 'haunted-castle'],
    logLabel: 'Castles',
  });

  assertEquals(infoLogs.length, 1);
});

Deno.test('configureSplitPile does not replace cards when desired order already matches', () => {
  const existingCards = [
    createTestCard({ cardKey: 'small-castle', randomizerData: { randomizer: 'castles' } }),
    createTestCard({ cardKey: 'haunted-castle', randomizerData: { randomizer: 'castles' } }),
  ];

  const { context, infoLogs } = createContext({
    kingdomSupply: [{ name: 'castles', cards: existingCards }],
    cardLibrary: {
      'small-castle': createTestCard({ cardKey: 'small-castle' }),
      'haunted-castle': createTestCard({ cardKey: 'haunted-castle' }),
    },
  });

  configureSplitPile(context, {
    pileKey: 'castles',
    desiredOrder: ['small-castle', 'haunted-castle'],
    logLabel: 'Castles',
  });

  assertStrictEquals(context.config.kingdomSupply[0].cards, existingCards);
  assertEquals(infoLogs.length, 1);
});

Deno.test('configureSplitPile rewrites pile cards using cloned templates in desired order', () => {
  const cardLibrary = {
    'small-castle': createTestCard({ cardKey: 'small-castle' }),
    'haunted-castle': createTestCard({ cardKey: 'haunted-castle' }),
  };

  const { context, logLogs } = createContext({
    kingdomSupply: [{ name: 'castles', cards: [createTestCard({ cardKey: 'placeholder', randomizerData: { randomizer: 'castles' } })] }],
    cardLibrary,
  });

  configureSplitPile(context, {
    pileKey: 'castles',
    desiredOrder: ['small-castle', 'haunted-castle'],
    logLabel: 'Castles',
  });

  const nextCards = context.config.kingdomSupply[0].cards;
  assertEquals(nextCards.map(card => card.cardKey), ['small-castle', 'haunted-castle']);
  assertNotStrictEquals(nextCards[0], cardLibrary['small-castle']);
  assertNotStrictEquals(nextCards[1], cardLibrary['haunted-castle']);
  assertEquals(logLogs.length, 1);
});

Deno.test('configureSplitPile skips missing templates and logs a warning', () => {
  const { context, warnLogs } = createContext({
    kingdomSupply: [{ name: 'castles', cards: [createTestCard({ cardKey: 'placeholder', randomizerData: { randomizer: 'castles' } })] }],
    cardLibrary: {
      'small-castle': createTestCard({ cardKey: 'small-castle' }),
    },
  });

  configureSplitPile(context, {
    pileKey: 'castles',
    desiredOrder: ['small-castle', 'missing-castle'],
    logLabel: 'Castles',
  });

  assertEquals(context.config.kingdomSupply[0].cards.map(card => card.cardKey), ['small-castle']);
  assertEquals(warnLogs.length, 1);
});
