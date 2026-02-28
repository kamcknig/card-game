import { assertEquals } from '@std/assert';
import { resolveChooseAbilities } from '../resolve-choose-abilities.ts';
import { PromptServiceStub } from '../../testing/prompt-service-stub.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';

Deno.test('resolveChooseAbilities resolves selected options in printed order', async () => {
  const promptService = new PromptServiceStub();
  promptService.enqueueActions(2, 1, 3);

  const { loggerService } = createTestLogger();
  const resolvedLabels: string[] = [];

  const result = await resolveChooseAbilities({
    context: {
      cardId: 101,
      playerId: 1,
      promptService,
      loggerService,
      reactionContext: {
        chooseAbilityModifiersByCardId: {
          101: { additionalChoices: 1 },
        },
      },
    },
    logTag: 'choose-test',
    options: [
      {
        action: 1,
        label: 'first',
        resolve: async () => {
          resolvedLabels.push('first');
        },
      },
      {
        action: 2,
        label: 'second',
        resolve: async () => {
          resolvedLabels.push('second');
        },
      },
      {
        action: 3,
        label: 'third',
        resolve: async () => {
          resolvedLabels.push('third');
        },
      },
    ],
    baseChoiceCount: 2,
  });

  assertEquals(result, [1, 2, 3]);
  assertEquals(resolvedLabels, ['first', 'second', 'third']);
  assertEquals(promptService.requestedActions.length, 3);
});

Deno.test('resolveChooseAbilities ignores invalid extra selections and logs a warning', async () => {
  const promptService = new PromptServiceStub();
  promptService.enqueueActions(1, 999);

  const { entries, loggerService } = createTestLogger();

  const result = await resolveChooseAbilities({
    context: {
      cardId: 202,
      playerId: 1,
      promptService,
      loggerService,
      reactionContext: {
        chooseAbilityModifiersByCardId: {
          202: { additionalChoices: 1 },
        },
      },
    },
    logTag: 'choose-test',
    options: [
      { action: 1, label: 'first', resolve: async () => {} },
      { action: 2, label: 'second', resolve: async () => {} },
    ],
    baseChoiceCount: 1,
  });

  assertEquals(result, [1]);
  assertEquals(entries.some(entry => entry.level === 'warn' && String(entry.args[1]).includes('invalid')), true);
});

Deno.test('resolveChooseAbilities returns early when no options exist', async () => {
  const promptService = new PromptServiceStub();
  const { loggerService } = createTestLogger();

  const result = await resolveChooseAbilities({
    context: {
      cardId: 999,
      playerId: 1,
      promptService,
      loggerService,
      reactionContext: {},
    },
    logTag: 'choose-test',
    options: [],
    baseChoiceCount: 1,
  });

  assertEquals(result, []);
  assertEquals(promptService.requestedActions.length, 0);
});
