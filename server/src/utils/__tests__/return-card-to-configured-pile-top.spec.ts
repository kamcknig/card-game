import { assertEquals } from '@std/assert';
import type { Card, Match } from 'shared/types/index.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { returnCardToConfiguredPileTop } from '../return-card-to-configured-pile-top.ts';

// Builds a minimal runtime Card used by return-to-pile tests.
const createRuntimeCard = (args: { id: number; cardKey: string; kingdom?: string }): Card => {
  return {
    id: args.id,
    cardKey: args.cardKey,
    kingdom: args.kingdom ?? args.cardKey,
  } as Card;
};

Deno.test('returnCardToConfiguredPileTop moves card to resolved configured pile', async () => {
  const runCalls: Array<{ action: string; args: unknown }> = [];
  const debugLogs: unknown[][] = [];

  const moved = await returnCardToConfiguredPileTop({
    actionService: {
      run: async (action, args) => {
        runCalls.push({ action, args });
      },
    },
    loggerService: {
      debug: (...args: unknown[]) => debugLogs.push(args),
      warn: () => {},
    },
    match: {
      config: {
        basicSupply: [],
        kingdomSupply: [{ name: 'village', cards: [createTestCard({ cardKey: 'village' })] }],
      },
    } as unknown as Match,
    card: createRuntimeCard({ id: 77, cardKey: 'village' }),
    logTag: 'return-test',
    facing: 'back',
  });

  assertEquals(moved, true);
  assertEquals(runCalls, [
    {
      action: 'moveCard',
      args: {
        cardId: 77,
        to: { location: 'kingdomSupply' },
        facing: 'back',
      },
    },
  ]);
  assertEquals(debugLogs.length, 1);
});

Deno.test('returnCardToConfiguredPileTop returns false and warns when no configured pile exists', async () => {
  const runCalls: Array<{ action: string; args: unknown }> = [];
  const warnLogs: unknown[][] = [];

  const moved = await returnCardToConfiguredPileTop({
    actionService: {
      run: async (action, args) => {
        runCalls.push({ action, args });
      },
    },
    loggerService: {
      debug: () => {},
      warn: (...args: unknown[]) => warnLogs.push(args),
    },
    match: {
      config: {
        basicSupply: [],
        kingdomSupply: [],
        nonSupply: [],
      },
    } as unknown as Match,
    card: createRuntimeCard({ id: 88, cardKey: 'missing-card' }),
    logTag: 'return-test',
  });

  assertEquals(moved, false);
  assertEquals(runCalls.length, 0);
  assertEquals(warnLogs.length, 1);
});
