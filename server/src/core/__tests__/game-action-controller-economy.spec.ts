import { assertEquals } from '@std/assert';
import { Card } from 'shared/types/index.ts';
import type { CardId, Match, PlayerId } from 'shared/types/index.ts';
import type {
  ActionService,
  AppSocket,
  CardEffectFunctionMap,
  FindCardService,
  PromptService,
} from '@server-types/index.ts';
import { GameActionController } from '../actions/game-action-controller.ts';
import { CardSourceController } from '../card-source-controller.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { LogManager } from '../log-manager.ts';
import { ReactionManager } from '../reactions/reaction-manager.ts';
import { CardInteractivityController } from '../card-interactivity-controller.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { BuyOptionsResolver, ResolvedBuyOption } from '../actions/resolve-buy-options.ts';
import { CardEffectContextFactory } from '../actions/card-effect-context-factory.ts';
import { TokenRegistryService } from '../tokens/token-registry-service.ts';
import { RngService } from '../rng-service.ts';
import { PromptAbortRegistry } from '../undo/prompt-abort-registry.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';
import { createTestCard } from '../../testing/create-test-card.ts';

// ---------------------------------------------------------------------------
// Regression coverage for Phase 2 (buy pipeline / player-economy hardening):
// exchangeCoffer clamping and buyCard overpay math. GameActionController has
// a large constructor surface; every dependency the exercised paths (buyCard
// -> gainCard -> moveCard, exchangeCoffer) don't touch is a bare inert stub,
// mirroring the pattern in match-undo-vote-service.spec.ts.
// ---------------------------------------------------------------------------

const PLAYER_ID: PlayerId = 1;

/** Minimal Match fixture containing only the fields the exercised actions read/write. */
const makeMatch = (overrides: Partial<Match> = {}): Match =>
  ({
    coffers: {},
    debt: {},
    playerTreasure: 0,
    playerPotions: 0,
    playerBuys: 1,
    turnPhaseIndex: 1, // 'buy'
    turnNumber: 1,
    stats: {
      turns: [{}],
      cardsBoughtByTurn: [],
      cardsBought: {},
      cardsGainedByTurn: [],
      cardsGained: {},
    },
    config: { basicSupply: [], kingdomSupply: [] },
    // exchangeCoffer/spendVillager require the caller to be the current
    // turn's player; default the fixture to PLAYER_ID's own turn so tests
    // that don't care about turn-ownership don't need to set this up.
    currentPlayerTurnIndex: 0,
    players: [{ id: PLAYER_ID }],
    ...overrides,
  }) as unknown as Match;

/**
 * Fake CardSourceController: `findCardSource` always reports "not found"
 * (the test card starts unplaced), and `getSource` lazily hands back a
 * mutable array per location/player so moveCard can push/splice normally.
 */
const makeCardSourceControllerStub = (): CardSourceController => {
  const store = new Map<string, CardId[]>();
  return {
    findCardSource: () => {
      throw new Error('[test stub] no source for card');
    },
    getSource: (location: string, playerId?: PlayerId) => {
      const key = `${location}:${playerId ?? ''}`;
      if (!store.has(key)) store.set(key, []);
      return store.get(key)!;
    },
  } as unknown as CardSourceController;
};

/** No-op ReactionManager: none of the exercised paths assert on reaction fan-out. */
const makeReactionManagerStub = (): ReactionManager =>
  ({
    runTrigger: async () => undefined,
    runCardLifecycleEvent: async () => undefined,
    runGameLifecycleEvent: async () => undefined,
    cleanupDurationTriggers: () => undefined,
  }) as unknown as ReactionManager;

/** MatchCardLibrary backed by a plain Map, seeded with the test card. */
const makeCardLibraryStub = (cards: Map<CardId, Card>): MatchCardLibrary =>
  ({
    getCard: (id: CardId) => {
      const card = cards.get(id);
      if (!card) throw new Error(`[test stub] unable to locate card ${id}`);
      return card;
    },
    removeCard: () => undefined,
    addCard: () => undefined,
  }) as unknown as MatchCardLibrary;

/** BuyOptionsResolver stub that always offers a single standard buy option at the card's cost. */
const makeBuyOptionsResolverStub = (card: Card): BuyOptionsResolver =>
  ({
    resolveBuyOptions: () => ({
      card,
      cost: card.cost,
      options: [{ id: 'standard', label: '', kind: 'standard', cost: card.cost } as ResolvedBuyOption],
    }),
  }) as unknown as BuyOptionsResolver;

/**
 * Assembles a GameActionController with stub collaborators sufficient to
 * drive exchangeCoffer and buyCard's standard-payment path.
 */
const makeController = (opts: { match?: Partial<Match>; cardCost?: number } = {}) => {
  const { loggerService } = createTestLogger();
  const match = makeMatch(opts.match);
  const card = new Card({
    ...createTestCard({ cost: { treasure: opts.cardCost ?? 5 } }),
    id: 1,
  });
  const cardLibrary = makeCardLibraryStub(new Map([[card.id, card]]));
  const cardSourceController = makeCardSourceControllerStub();
  const reactionManager = makeReactionManagerStub();
  const buyOptionsResolver = makeBuyOptionsResolverStub(card);
  const logManager = { addLogEntry: () => undefined } as unknown as LogManager;
  const inertCardEffectMap = {} as unknown as CardEffectFunctionMap;

  const controller = new GameActionController(
    cardSourceController,
    {} as unknown as FindCardService,
    {} as unknown as CardPriceRulesController,
    inertCardEffectMap,
    inertCardEffectMap,
    inertCardEffectMap,
    inertCardEffectMap,
    inertCardEffectMap,
    inertCardEffectMap,
    inertCardEffectMap,
    inertCardEffectMap,
    match,
    cardLibrary,
    logManager,
    new Map<PlayerId, AppSocket>(),
    reactionManager,
    {} as unknown as CardInteractivityController,
    buyOptionsResolver,
    {} as unknown as PromptService,
    { run: async () => undefined } as unknown as ActionService,
    {} as unknown as CardEffectContextFactory,
    {} as unknown as TokenRegistryService,
    {} as unknown as RngService,
    loggerService,
    {} as unknown as PromptAbortRegistry,
  );

  return { controller, match, card };
};

// ---------------------------------------------------------------------------
// exchangeCoffer
// ---------------------------------------------------------------------------

Deno.test('exchangeCoffer is a no-op with no NaN when the player has no coffers', async () => {
  const { controller, match } = makeController({ match: { playerTreasure: 3 } });

  await controller.exchangeCoffer({ playerId: PLAYER_ID, count: 2 });

  assertEquals(match.coffers[PLAYER_ID], 0);
  assertEquals(match.playerTreasure, 3);
  assertEquals(Number.isNaN(match.coffers[PLAYER_ID]), false);
});

Deno.test('exchangeCoffer clamps an over-large request to the available coffer count', async () => {
  const { controller, match } = makeController({
    match: { coffers: { [PLAYER_ID]: 2 }, playerTreasure: 0 },
  });

  await controller.exchangeCoffer({ playerId: PLAYER_ID, count: 10 });

  assertEquals(match.coffers[PLAYER_ID], 0);
  assertEquals(match.playerTreasure, 2);
});

Deno.test('exchangeCoffer no-ops on a negative count', async () => {
  const { controller, match } = makeController({
    match: { coffers: { [PLAYER_ID]: 4 }, playerTreasure: 0 },
  });

  await controller.exchangeCoffer({ playerId: PLAYER_ID, count: -5 });

  assertEquals(match.coffers[PLAYER_ID], 4);
  assertEquals(match.playerTreasure, 0);
});

// ---------------------------------------------------------------------------
// buyCard overpay
// ---------------------------------------------------------------------------

Deno.test('buyCard treasure-only overpay reduces treasure by cost + overpay', async () => {
  const { controller, match, card } = makeController({
    cardCost: 5,
    match: { playerTreasure: 10 },
  });

  await controller.buyCard({
    cardId: card.id,
    playerId: PLAYER_ID,
    cardCost: card.cost,
    overpay: { inTreasure: 2, inCoffer: 0 },
  });

  // 10 - (5 base + 2 overpay) = 3.
  assertEquals(match.playerTreasure, 3);
  assertEquals(match.stats.cardsBought[card.id].paid, 7);
});

Deno.test('buyCard coffer overpay nets coffers -n and treasure -cost', async () => {
  const { controller, match, card } = makeController({
    cardCost: 5,
    match: { playerTreasure: 5, coffers: { [PLAYER_ID]: 3 } },
  });

  await controller.buyCard({
    cardId: card.id,
    playerId: PLAYER_ID,
    cardCost: card.cost,
    overpay: { inTreasure: 0, inCoffer: 3 },
  });

  // Coffers are exchanged into treasure (5 + 3 = 8), base cost (5) and the
  // 3-coffer overpay are then spent (8 - 5 - 3 = 0) -- net effect: coffers -3,
  // treasure -5 (the base cost) relative to the starting values.
  assertEquals(match.coffers[PLAYER_ID], 0);
  assertEquals(match.playerTreasure, 0);
  assertEquals(match.stats.cardsBought[card.id].paid, 8);
});

Deno.test('buyCard clamps overpay to what the player actually holds', async () => {
  const { controller, match, card } = makeController({
    cardCost: 5,
    // Only 6 treasure total and 1 coffer: requesting far more than available
    // must not manufacture money.
    match: { playerTreasure: 6, coffers: { [PLAYER_ID]: 1 } },
  });

  await controller.buyCard({
    cardId: card.id,
    playerId: PLAYER_ID,
    cardCost: card.cost,
    overpay: { inTreasure: 50, inCoffer: 50 },
  });

  // Coffer overpay clamps to the 1 available coffer (exchanged into treasure:
  // 6 + 1 = 7). Base cost (5) leaves 2 spendable for the remaining requested
  // overpay (50 treasure + 1 coffer, clamped to 2) -> treasure ends at 0.
  assertEquals(match.coffers[PLAYER_ID], 0);
  assertEquals(match.playerTreasure, 0);
  assertEquals(match.stats.cardsBought[card.id].paid, 7);
});

Deno.test('buyCard with no overpay only deducts the base cost', async () => {
  const { controller, match, card } = makeController({
    cardCost: 4,
    match: { playerTreasure: 10 },
  });

  await controller.buyCard({
    cardId: card.id,
    playerId: PLAYER_ID,
    cardCost: card.cost,
  });

  assertEquals(match.playerTreasure, 6);
  assertEquals(match.stats.cardsBought[card.id].paid, 4);
});
