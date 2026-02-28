import { assertEquals } from '@std/assert';
import { ReactionContext, ReactionTrigger } from '../../types.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';
import { initImmunityScope, isPlayerImmune, markPlayerImmune } from '../reaction-immunity.ts';

Deno.test('markPlayerImmune marks immunity that can be queried with isPlayerImmune', () => {
  const reactionContext: ReactionContext = {};

  assertEquals(isPlayerImmune(reactionContext, 1), false);
  markPlayerImmune(1, reactionContext);

  assertEquals(isPlayerImmune(reactionContext, 1), true);
  assertEquals(isPlayerImmune(reactionContext, 2), false);
});

Deno.test('initImmunityScope initializes scope and emits debug log once', () => {
  const reactionContext: ReactionContext = {};
  const trigger = new ReactionTrigger('drawCards', { count: 1, playerId: 1 });
  const { entries, loggerService } = createTestLogger();

  initImmunityScope(reactionContext, trigger, loggerService);

  assertEquals(reactionContext.immunityScope, '[TRIGGER drawCards]');
  assertEquals(entries.some(entry => entry.level === 'debug' && String(entry.args).includes('initialized scope')), true);
});

Deno.test('initImmunityScope logs warning when a different scope is reused', () => {
  const reactionContext: ReactionContext = {
    immunityScope: '[TRIGGER drawCards]',
  };
  const trigger = new ReactionTrigger('startTurn', { playerId: 1, turnNumber: 1 });
  const { entries, loggerService } = createTestLogger();

  initImmunityScope(reactionContext, trigger, loggerService);

  assertEquals(entries.some(entry => entry.level === 'warn' && String(entry.args).includes('reused across triggers')), true);
});
