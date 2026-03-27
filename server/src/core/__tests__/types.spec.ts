import { assertEquals } from '@std/assert';
import { Reaction, ReactionTrigger } from '../../types.ts';
import type { ReactionTemplate } from '../../types.ts';

// Builds a minimal ReactionTemplate for constructing Reaction instances in tests.
const createMinimalReactionTemplate = (
  overrides: Partial<ReactionTemplate<'cardGained'>> = {},
): ReactionTemplate<'cardGained'> => ({
  id: 'village:42',
  listeningFor: 'cardGained',
  triggeredEffectFn: async () => {},
  ...overrides,
} as ReactionTemplate<'cardGained'>);

// --- ReactionTrigger ---

Deno.test('ReactionTrigger constructor assigns eventType and args', () => {
  const trigger = new ReactionTrigger('startTurn', { playerId: 1, turnNumber: 3 });

  assertEquals(trigger.eventType, 'startTurn');
  assertEquals(trigger.args, { playerId: 1, turnNumber: 3 });
});

Deno.test('ReactionTrigger.toString returns formatted trigger string', () => {
  const trigger = new ReactionTrigger('cardGained', {
    playerId: 1,
    cardId: 42,
    bought: true,
  });

  assertEquals(trigger.toString(), '[TRIGGER cardGained]');
});

Deno.test('ReactionTrigger Deno.customInspect returns toString value', () => {
  const trigger = new ReactionTrigger('cardTrashed', {
    cardId: 10,
    playerId: 1,
    previousLocation: { location: 'playerHand' },
  });

  const inspectFn = trigger[Symbol.for('Deno.customInspect') as unknown as keyof ReactionTrigger] as () => string;
  assertEquals(inspectFn.call(trigger), '[TRIGGER cardTrashed]');
});

// --- Reaction ---

Deno.test('Reaction constructor assigns all fields with defaults', () => {
  const reaction = new Reaction(createMinimalReactionTemplate());

  assertEquals(reaction.id, 'village:42');
  assertEquals(reaction.listeningFor, 'cardGained');
  assertEquals(reaction.once, false);
  assertEquals(reaction.compulsory, false);
  assertEquals(reaction.system, false);
  assertEquals(reaction.autoResolve, false);
  assertEquals(reaction.allowMultipleInstances, true);
  assertEquals(typeof reaction.condition, 'function');
  assertEquals(typeof reaction.triggeredEffectFn, 'function');
  assertEquals(reaction.playerId, undefined);
  assertEquals(reaction.sourceId, undefined);
  assertEquals(reaction.sourceKey, undefined);
  assertEquals(reaction.sourceName, undefined);
  assertEquals(reaction.sourceType, undefined);
});

Deno.test('Reaction constructor uses provided optional values', () => {
  const reaction = new Reaction(createMinimalReactionTemplate({
    playerId: 1,
    once: true,
    compulsory: true,
    system: true,
    autoResolve: true,
    allowMultipleInstances: false,
    sourceId: 100,
    sourceKey: 'moat',
    sourceName: 'Moat',
    sourceType: 'card',
    condition: () => false,
  }));

  assertEquals(reaction.playerId, 1);
  assertEquals(reaction.once, true);
  assertEquals(reaction.compulsory, true);
  assertEquals(reaction.system, true);
  assertEquals(reaction.autoResolve, true);
  assertEquals(reaction.allowMultipleInstances, false);
  assertEquals(reaction.sourceId, 100);
  assertEquals(reaction.sourceKey, 'moat');
  assertEquals(reaction.sourceName, 'Moat');
  assertEquals(reaction.sourceType, 'card');
});

Deno.test('Reaction.getBaseId returns key:id from id field', () => {
  const reaction = new Reaction(createMinimalReactionTemplate({ id: 'market:55' }));

  assertEquals(reaction.getBaseId(), 'market:55');
});

Deno.test('Reaction.getSourceKey returns the part before the colon', () => {
  const reaction = new Reaction(createMinimalReactionTemplate({ id: 'village:42' }));

  assertEquals(reaction.getSourceKey(), 'village');
});

Deno.test('Reaction.getSourceId returns the numeric part after the colon', () => {
  const reaction = new Reaction(createMinimalReactionTemplate({ id: 'village:42' }));

  assertEquals(reaction.getSourceId(), 42);
});

Deno.test('Reaction.toString includes owner playerId when set', () => {
  const reaction = new Reaction(createMinimalReactionTemplate({ playerId: 3 }));

  assertEquals(reaction.toString(), '[REACTION village:42 - owner {3}]');
});

Deno.test('Reaction.toString uses global when no playerId', () => {
  const reaction = new Reaction(createMinimalReactionTemplate());

  assertEquals(reaction.toString(), '[REACTION village:42 - owner {global}]');
});

Deno.test('Reaction Deno.customInspect returns toString value', () => {
  const reaction = new Reaction(createMinimalReactionTemplate({ playerId: 2 }));

  const inspectFn = reaction[Symbol.for('Deno.customInspect') as unknown as keyof Reaction] as () => string;
  assertEquals(inspectFn.call(reaction), '[REACTION village:42 - owner {2}]');
});

Deno.test('Reaction default condition returns true', () => {
  const reaction = new Reaction(createMinimalReactionTemplate());

  // Default condition (from ?? (() => true)) should return true for any input.
  assertEquals(reaction.condition!({} as never), true);
});
