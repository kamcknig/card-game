import { assertEquals } from '@std/assert';
import type { CardId } from 'shared/types/index.ts';
import { discardDownTo } from '../discard-down-to.ts';

type DiscardDownToContext = Parameters<typeof discardDownTo>[0];

// Builds discard helper context with controllable hand and action-service responses.
const createDiscardContext = (args: {
  hand: CardId[];
  selectedCardIds: CardId[];
}) => {
  const runCalls: Array<{ action: string; args: unknown }> = [];
  const warnLogs: unknown[][] = [];

  const context = {
    cardSourceController: {
      getSource: () => args.hand,
    },
    actionService: {
      run: async (action: string, actionArgs: unknown) => {
        runCalls.push({ action, args: actionArgs });
        if (action === 'selectCard') {
          return args.selectedCardIds;
        }
        return null;
      },
    },
    cardLibrary: {
      getCard: (cardId: number) => `card-${cardId}`,
    },
    loggerService: {
      debug: () => {},
      warn: (...items: unknown[]) => warnLogs.push(items),
    },
  } as unknown as DiscardDownToContext;

  return {
    context,
    runCalls,
    warnLogs,
  };
};

Deno.test('discardDownTo does nothing when player hand is already at or below target size', async () => {
  const { context, runCalls } = createDiscardContext({
    hand: [1, 2, 3],
    selectedCardIds: [1],
  });

  await discardDownTo(context, {
    playerId: 1,
    targetHandSize: 3,
    logTag: 'discard-test',
  });

  assertEquals(runCalls.length, 0);
});

Deno.test('discardDownTo warns and exits when no cards are selected', async () => {
  const { context, runCalls, warnLogs } = createDiscardContext({
    hand: [1, 2, 3, 4],
    selectedCardIds: [],
  });

  await discardDownTo(context, {
    playerId: 1,
    targetHandSize: 2,
    logTag: 'discard-test',
  });

  assertEquals(runCalls.length, 1);
  assertEquals(runCalls[0].action, 'selectCard');
  assertEquals(warnLogs.length, 1);
});

Deno.test('discardDownTo discards each selected card after selection', async () => {
  const { context, runCalls } = createDiscardContext({
    hand: [10, 11, 12, 13],
    selectedCardIds: [11, 13],
  });

  await discardDownTo(context, {
    playerId: 1,
    targetHandSize: 2,
    logTag: 'discard-test',
    prompt: 'Pick discards',
  });

  assertEquals(runCalls.map(call => call.action), ['selectCard', 'discardCard', 'discardCard']);
  assertEquals(runCalls[1].args, { cardId: 11, playerId: 1 });
  assertEquals(runCalls[2].args, { cardId: 13, playerId: 1 });
});
