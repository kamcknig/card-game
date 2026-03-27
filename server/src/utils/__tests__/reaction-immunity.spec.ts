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

Deno.test('isPlayerImmune returns false when reactionContext is undefined', () => {
  assertEquals(isPlayerImmune(undefined, 1), false);
});

Deno.test('isPlayerImmune returns false when immunityByPlayerId is not set', () => {
  const reactionContext: ReactionContext = {};
  assertEquals(isPlayerImmune(reactionContext, 1), false);
});

Deno.test('markPlayerImmune does nothing when reactionContext is undefined', () => {
  // Should not throw when called with undefined context.
  markPlayerImmune(1, undefined);
});

Deno.test('markPlayerImmune initializes immunityByPlayerId when absent', () => {
  const reactionContext: ReactionContext = {};

  markPlayerImmune(1, reactionContext);

  assertEquals(reactionContext.immunityByPlayerId, { 1: true });
});

Deno.test('initImmunityScope does nothing when reactionContext is undefined', () => {
  const trigger = new ReactionTrigger('drawCards', { count: 1, playerId: 1 });
  // Should not throw when called with undefined context.
  initImmunityScope(undefined, trigger);
});

Deno.test('initImmunityScope is a no-op when called again with the same trigger scope', () => {
  const reactionContext: ReactionContext = {};
  const trigger = new ReactionTrigger('drawCards', { count: 1, playerId: 1 });
  const { entries, loggerService } = createTestLogger();

  initImmunityScope(reactionContext, trigger, loggerService);
  initImmunityScope(reactionContext, trigger, loggerService);

  // Only one debug log for initialization, no warning for same-scope re-entry.
  assertEquals(entries.filter(e => e.level === 'debug').length, 1);
  assertEquals(entries.filter(e => e.level === 'warn').length, 0);
});
