import { assertEquals } from '@std/assert';
import type { Match, PlayerId } from 'shared/types/index.ts';
import type { ActionService, FindCardService, SupplyGainService } from '@server-types/index.ts';
import { ReactionManager } from '../reactions/reaction-manager.ts';
import { ReactionContextFactory } from '../reactions/reaction-context-factory.ts';
import { ReactionTrigger } from '../../types.ts';
import { CardSourceController } from '../card-source-controller.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { LogManager } from '../log-manager.ts';
import { CardInstanceFactoryService } from '../card-instance-factory-service.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { ExpansionCardMetadataRegistryService } from '../expansion-card-metadata-registry-service.ts';
import { ExpansionCatalogService } from '../expansion-catalog-service.ts';
import { RngService } from '../rng-service.ts';
import { PromptServiceStub } from '../../testing/prompt-service-stub.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';

// ---------------------------------------------------------------------------
// Regression coverage for Phase 3 (compulsory reactions cannot be cancelled):
// declining the reaction prompt (action === 0) must only drop optional
// candidates from the current pass -- compulsory reactions must still run.
// ReactionManager has a large constructor surface; every dependency the
// exercised path (runTrigger -> prompt -> runReaction) doesn't touch is a
// bare inert stub, mirroring the pattern in game-action-controller-economy.spec.ts.
// ---------------------------------------------------------------------------

const PLAYER_ID: PlayerId = 1;

/** Minimal Match fixture containing only the fields runTrigger reads. */
const makeMatch = (): Match =>
  ({
    players: [{ id: PLAYER_ID }],
    currentPlayerTurnIndex: 0,
  }) as unknown as Match;

/** Assembles a ReactionManager with stub collaborators sufficient to drive runTrigger. */
const makeReactionManager = () => {
  const { loggerService } = createTestLogger();
  const match = makeMatch();
  const cardLibrary = {} as unknown as MatchCardLibrary;
  const logManager = { withIndent: async (fn: () => unknown) => await fn() } as unknown as LogManager;
  const actionService = { run: async () => undefined } as unknown as ActionService;
  const promptService = new PromptServiceStub();

  const reactionContextFactory = new ReactionContextFactory(
    {} as unknown as CardSourceController,
    {} as unknown as FindCardService,
    {} as unknown as SupplyGainService,
    {} as unknown as CardPriceRulesController,
    logManager,
    loggerService,
    {} as unknown as RngService,
    match,
    cardLibrary,
    {} as unknown as CardInstanceFactoryService,
    actionService,
    promptService,
    {} as unknown as ExpansionCatalogService,
  );

  const reactionManager = new ReactionManager(
    {} as unknown as CardSourceController,
    {} as unknown as FindCardService,
    {} as unknown as SupplyGainService,
    {} as unknown as CardPriceRulesController,
    logManager,
    match,
    cardLibrary,
    {} as unknown as CardInstanceFactoryService,
    actionService,
    promptService,
    reactionContextFactory,
    {} as unknown as ExpansionCardMetadataRegistryService,
    loggerService,
  );

  return { reactionManager, promptService, match };
};

const makeTrigger = () =>
  new ReactionTrigger('afterCardPlayed', {
    cardId: 999,
    playerId: PLAYER_ID,
    wayId: null,
    followedPlayedCardInstructions: false,
  });

Deno.test('runTrigger: two compulsory reactions from different cards still both execute after Cancel', async () => {
  const { reactionManager, promptService } = makeReactionManager();
  const executed: string[] = [];

  reactionManager.registerReactionTemplate({
    id: 'card-a:1:afterCardPlayed',
    listeningFor: 'afterCardPlayed',
    playerId: PLAYER_ID,
    compulsory: true,
    sourceName: 'Card A',
    triggeredEffectFn: async () => {
      executed.push('card-a');
    },
  });
  reactionManager.registerReactionTemplate({
    id: 'card-b:2:afterCardPlayed',
    listeningFor: 'afterCardPlayed',
    playerId: PLAYER_ID,
    compulsory: true,
    sourceName: 'Card B',
    triggeredEffectFn: async () => {
      executed.push('card-b');
    },
  });

  // First response (0) simulates Cancel/decline; since both candidates are
  // compulsory this must not skip either -- it re-prompts for ordering.
  // Second response (1) picks the first reaction; the second auto-resolves
  // once it is the sole remaining compulsory candidate.
  promptService.enqueueActions(0, 1);

  await reactionManager.runTrigger({ trigger: makeTrigger() });

  assertEquals(executed.sort(), ['card-a', 'card-b']);
  // Only 2 prompts: the declined ordering choice, then the real ordering
  // choice. The final compulsory reaction auto-resolves without a prompt.
  assertEquals(promptService.requestedActions.length, 2);
});

Deno.test('runTrigger: Cancel with one optional + one compulsory reaction skips only the optional one', async () => {
  const { reactionManager, promptService } = makeReactionManager();
  const executed: string[] = [];

  reactionManager.registerReactionTemplate({
    id: 'card-optional:1:afterCardPlayed',
    listeningFor: 'afterCardPlayed',
    playerId: PLAYER_ID,
    compulsory: false,
    sourceName: 'Card Optional',
    triggeredEffectFn: async () => {
      executed.push('card-optional');
    },
  });
  reactionManager.registerReactionTemplate({
    id: 'card-compulsory:2:afterCardPlayed',
    listeningFor: 'afterCardPlayed',
    playerId: PLAYER_ID,
    compulsory: true,
    sourceName: 'Card Compulsory',
    triggeredEffectFn: async () => {
      executed.push('card-compulsory');
    },
  });

  // Declining drops the optional candidate; the compulsory one still runs,
  // auto-resolving without a second prompt once it's the only one left.
  promptService.enqueueActions(0);

  await reactionManager.runTrigger({ trigger: makeTrigger() });

  assertEquals(executed, ['card-compulsory']);
  assertEquals(promptService.requestedActions.length, 1);
});
