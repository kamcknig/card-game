import { assertEquals } from '@std/assert';
import type { CardKey, ComputedMatchConfiguration, Match } from 'shared/types/index.ts';
import type { EndGamePolicyFn, FindCardService } from '@server-types/index.ts';
import { EndGameEvaluatorService } from '../end-game-evaluator-service.ts';
import { EndGamePolicyRegistryService } from '../end-game-policy-registry-service.ts';
import { createInitialMatchState } from '../match-state-factory.ts';
import type { CardSourceController } from '../card-source-controller.ts';
import type { MatchCardLibrary } from '../match-card-library.ts';
import type { CardPriceRulesController } from '../card-price-rules-controller.ts';
import type { LogManager } from '../log-manager.ts';
import type { RngService } from '../rng-service.ts';
import type { ReactionManager } from '../reactions/reaction-manager.ts';
import type { SupplyGainService } from '@server-types/index.ts';
import type { PromptService } from '@server-types/index.ts';
import type { LoggerService } from '../logger-service.ts';

// No-op logger stub — these tests assert on evaluator return values, not logs.
const buildLoggerStub = (): LoggerService =>
  ({
    debug: () => {},
    info: () => {},
    log: () => {},
    warn: () => {},
    error: () => {},
  }) as unknown as LoggerService;

// Builds a match with a configured supply whose pile count and province presence
// are controlled directly so `shouldEndGame` behavior can be exercised without a
// full FindCardsService.
const buildMatch = (opts: { pileCount: number; provincePresent: boolean }): Match => {
  const match = createInitialMatchState();
  const basicSupply: ComputedMatchConfiguration['basicSupply'] = [];
  // Fill the configured supply with `pileCount` uniquely-named piles so
  // getConfiguredSupplyPileKeys() reports the requested starting pile count.
  for (let i = 0; i < opts.pileCount; i++) {
    basicSupply.push({ name: `pile-${i}` as CardKey, cards: [] });
  }
  if (opts.provincePresent) {
    basicSupply.push({ name: 'province' as CardKey, cards: [] });
  }
  match.config = { ...match.config, basicSupply, kingdomSupply: [] } as ComputedMatchConfiguration;
  return match;
};

// Minimal FindCardService stub: province-pile query reflects `provincePresent`;
// remaining supply count is directly injected for emptyPileCount control.
const buildFindCardServiceStub = (opts: { provincePresent: boolean; remainingSupplyCount: number }): FindCardService =>
  ({
    findCards: (query: unknown) => {
      const q = query as { all?: { cardKeys?: unknown }[] };
      const isProvinceQuery = q.all?.some(clause => clause.cardKeys === 'province');
      if (isProvinceQuery) {
        return opts.provincePresent ? [{ id: 1 }] : [];
      }
      return [];
    },
    matchesFilter: () => false,
    getCardsInPlay: () => [],
    getRemainingSupplyCount: () => opts.remainingSupplyCount,
    findTopSupplyCardForPileKey: () => undefined,
    findTopNonSupplyCardForPileName: () => undefined,
  }) as unknown as FindCardService;

const buildEvaluator = (opts: {
  pileCount: number;
  provincePresent: boolean;
  remainingSupplyCount: number;
  policyRegistryService?: EndGamePolicyRegistryService;
}) => {
  const match = buildMatch({ pileCount: opts.pileCount, provincePresent: opts.provincePresent });
  const findCardService = buildFindCardServiceStub({
    provincePresent: opts.provincePresent,
    remainingSupplyCount: opts.remainingSupplyCount,
  });
  const endGamePolicyRegistryService = opts.policyRegistryService ?? new EndGamePolicyRegistryService();
  const evaluator = new EndGameEvaluatorService(
    match,
    {} as unknown as CardSourceController,
    {} as unknown as MatchCardLibrary,
    {} as unknown as CardPriceRulesController,
    {} as unknown as LogManager,
    {} as unknown as RngService,
    {} as unknown as ReactionManager,
    findCardService,
    {} as unknown as SupplyGainService,
    {} as unknown as PromptService,
    endGamePolicyRegistryService,
    buildLoggerStub(),
  );
  return { evaluator, match };
};

Deno.test('EndGameEvaluatorService: a policy returning endTriggered:false cannot clear a base-rule trigger', () => {
  // Base rules trigger via province-empty; the policy attempts to clear it.
  const registry = new EndGamePolicyRegistryService();
  const clearingPolicy: EndGamePolicyFn = () => ({ endTriggered: false, decision: 'continue' });
  registry.register(clearingPolicy);

  const { evaluator } = buildEvaluator({
    pileCount: 10,
    provincePresent: false, // province pile empty -> base shouldEndGame() === true
    remainingSupplyCount: 10,
    policyRegistryService: registry,
  });

  const result = evaluator.evaluateEndGame();

  assertEquals(result.shouldEndNow, true);
});

Deno.test('EndGameEvaluatorService: a policy can set endTriggered:true when base rules did not trigger', () => {
  const registry = new EndGamePolicyRegistryService();
  const triggeringPolicy: EndGamePolicyFn = () => ({ endTriggered: true, decision: 'continue' });
  registry.register(triggeringPolicy);

  const { evaluator } = buildEvaluator({
    pileCount: 10,
    provincePresent: true,
    remainingSupplyCount: 10, // emptyPileCount === 0 -> base shouldEndGame() === false
    policyRegistryService: registry,
  });

  const result = evaluator.evaluateEndGame();

  assertEquals(result.shouldEndNow, true);
});

Deno.test('EndGameEvaluatorService: emptyPileCount of 4 (a fourth pile emptying during a deferral) still ends the game', () => {
  const { evaluator } = buildEvaluator({
    pileCount: 10,
    provincePresent: true,
    remainingSupplyCount: 6, // emptyPileCount === 4
  });

  const result = evaluator.evaluateEndGame();

  assertEquals(result.shouldEndNow, true);
});

Deno.test('EndGameEvaluatorService: a defer decision short-circuits without running later policies', () => {
  const registry = new EndGamePolicyRegistryService();
  let laterPolicyCalled = false;

  const deferringPolicy: EndGamePolicyFn = () => ({ endTriggered: true, decision: 'defer' });
  const laterPolicy: EndGamePolicyFn = () => {
    laterPolicyCalled = true;
    return { endTriggered: false, decision: 'end_now' };
  };
  registry.register(deferringPolicy, { priority: 1 });
  registry.register(laterPolicy, { priority: 2 });

  const { evaluator } = buildEvaluator({
    pileCount: 10,
    provincePresent: false, // base shouldEndGame() === true, but defer wins
    remainingSupplyCount: 10,
    policyRegistryService: registry,
  });

  const result = evaluator.evaluateEndGame();

  assertEquals(result.shouldEndNow, false);
  assertEquals(laterPolicyCalled, false);
});
