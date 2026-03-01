import { assertEquals, assertStrictEquals } from '@std/assert';
import type { EndGamePolicyFn } from '@server-types/index.ts';
import { EndGamePolicyRegistryService } from '../end-game-policy-registry-service.ts';

Deno.test('EndGamePolicyRegistryService returns policies sorted by priority then registration order', () => {
  const registry = new EndGamePolicyRegistryService();

  const policyA = (() => ({ decision: 'continue' })) as EndGamePolicyFn;
  const policyB = (() => ({ decision: 'end_now' })) as EndGamePolicyFn;
  const policyC = (() => ({ decision: 'defer' })) as EndGamePolicyFn;
  const policyD = (() => ({ decision: 'continue' })) as EndGamePolicyFn;

  registry.register(policyA); // default priority 100, order 0
  registry.register(policyB, { priority: 10 }); // order 1
  registry.register(policyC, { priority: 10 }); // order 2
  registry.register(policyD, { priority: 200 }); // order 3

  const result = registry.getPolicies();

  assertStrictEquals(result[0], policyB);
  assertStrictEquals(result[1], policyC);
  assertStrictEquals(result[2], policyA);
  assertStrictEquals(result[3], policyD);
  assertEquals(result.length, 4);
});
