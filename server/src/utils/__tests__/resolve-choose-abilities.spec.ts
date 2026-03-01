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

Deno.test('resolveChooseAbilities player declines extra option with action 0', async () => {
  const promptService = new PromptServiceStub();
  // First action is mandatory pick; second is the "NO EXTRA OPTION" decline.
  promptService.enqueueActions(1, 0);

  const { loggerService } = createTestLogger();
  const resolvedLabels: string[] = [];

  const result = await resolveChooseAbilities({
    context: {
      cardId: 300,
      playerId: 1,
      promptService,
      loggerService,
      reactionContext: {
        chooseAbilityModifiersByCardId: {
          300: { additionalChoices: 1 },
        },
      },
    },
    logTag: 'decline-test',
    options: [
      { action: 1, label: 'first', resolve: async () => { resolvedLabels.push('first'); } },
      { action: 2, label: 'second', resolve: async () => { resolvedLabels.push('second'); } },
    ],
    baseChoiceCount: 1,
  });

  assertEquals(result, [1]);
  assertEquals(resolvedLabels, ['first']);
});

Deno.test('resolveChooseAbilities player declines extra option with null', async () => {
  const promptService = new PromptServiceStub();
  // Mandatory pick, then null decline.
  promptService.enqueueActions(1, null);

  const { loggerService } = createTestLogger();

  const result = await resolveChooseAbilities({
    context: {
      cardId: 301,
      playerId: 1,
      promptService,
      loggerService,
      reactionContext: {
        chooseAbilityModifiersByCardId: {
          301: { additionalChoices: 1 },
        },
      },
    },
    logTag: 'null-decline-test',
    options: [
      { action: 1, label: 'first', resolve: async () => {} },
      { action: 2, label: 'second', resolve: async () => {} },
    ],
    baseChoiceCount: 1,
  });

  assertEquals(result, [1]);
});

Deno.test('resolveChooseAbilities clamps baseChoiceCount to option count', async () => {
  const promptService = new PromptServiceStub();
  // Only two options but baseChoiceCount is 5; should only prompt twice.
  promptService.enqueueActions(1, 2);

  const { loggerService } = createTestLogger();

  const result = await resolveChooseAbilities({
    context: {
      cardId: 400,
      playerId: 1,
      promptService,
      loggerService,
      reactionContext: {},
    },
    logTag: 'clamp-test',
    options: [
      { action: 1, label: 'first', resolve: async () => {} },
      { action: 2, label: 'second', resolve: async () => {} },
    ],
    baseChoiceCount: 5,
  });

  assertEquals(result, [1, 2]);
  assertEquals(promptService.requestedActions.length, 2);
});

Deno.test('resolveChooseAbilities skips extra choices when allowOptionalExtraChoice is false', async () => {
  const promptService = new PromptServiceStub();
  promptService.enqueueActions(1);

  const { loggerService } = createTestLogger();

  const result = await resolveChooseAbilities({
    context: {
      cardId: 500,
      playerId: 1,
      promptService,
      loggerService,
      reactionContext: {
        chooseAbilityModifiersByCardId: {
          500: { additionalChoices: 2 },
        },
      },
    },
    logTag: 'no-extra-test',
    options: [
      { action: 1, label: 'first', resolve: async () => {} },
      { action: 2, label: 'second', resolve: async () => {} },
    ],
    baseChoiceCount: 1,
    allowOptionalExtraChoice: false,
  });

  assertEquals(result, [1]);
  // Only one prompt for the mandatory choice; no extra choice prompts.
  assertEquals(promptService.requestedActions.length, 1);
});

Deno.test('resolveChooseAbilities with no reactionContext modifiers has zero extra choices', async () => {
  const promptService = new PromptServiceStub();
  promptService.enqueueActions(2);

  const { loggerService } = createTestLogger();

  const result = await resolveChooseAbilities({
    context: {
      cardId: 600,
      playerId: 1,
      promptService,
      loggerService,
      reactionContext: undefined,
    },
    logTag: 'no-modifier-test',
    options: [
      { action: 1, label: 'first', resolve: async () => {} },
      { action: 2, label: 'second', resolve: async () => {} },
    ],
    baseChoiceCount: 1,
  });

  assertEquals(result, [2]);
  assertEquals(promptService.requestedActions.length, 1);
});

Deno.test('resolveChooseAbilities uses custom prompt text', async () => {
  const promptService = new PromptServiceStub();
  promptService.enqueueActions(1);

  const { loggerService } = createTestLogger();

  await resolveChooseAbilities({
    context: {
      cardId: 700,
      playerId: 1,
      promptService,
      loggerService,
      reactionContext: {},
    },
    logTag: 'prompt-test',
    prompt: 'Pick your ability',
    options: [
      { action: 1, label: 'first', resolve: async () => {} },
    ],
    baseChoiceCount: 1,
  });

  assertEquals(promptService.requestedActions[0].prompt, 'Pick your ability');
});
