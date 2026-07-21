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
import { BuyOptionsResolver } from '../actions/resolve-buy-options.ts';
import { CardEffectContextFactory } from '../actions/card-effect-context-factory.ts';
import { TokenRegistryService } from '../tokens/token-registry-service.ts';
import { RngService } from '../rng-service.ts';
import { PromptAbortRegistry } from '../undo/prompt-abort-registry.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';
import { createTestCard } from '../../testing/create-test-card.ts';

// ---------------------------------------------------------------------------
// Regression coverage for the generic Lose Track rule guard (`expectedFrom`)
// on moveCard/trashCard. GameActionController has a large constructor
// surface; every dependency the exercised paths don't touch is a bare inert
// stub, mirroring the pattern in game-action-controller-economy.spec.ts.
// ---------------------------------------------------------------------------

const PLAYER_ID: PlayerId = 1;

/** Minimal Match fixture containing only the fields the exercised actions read/write. */
const makeMatch = (overrides: Partial<Match> = {}): Match =>
  ({
    turnPhaseIndex: 0,
    turnNumber: 1,
    currentPlayerTurnIndex: 0,
    players: [{ id: PLAYER_ID }],
    stats: {
      turns: [{}],
      trashedCards: {},
      trashedCardsByTurn: [],
    },
    config: { basicSupply: [], kingdomSupply: [] },
    ...overrides,
  }) as unknown as Match;

/**
 * Fake CardSourceController backed by a plain Map keyed by `location:playerId`.
 * `place` seeds a card into a zone (top of pile = pushed last, matching the
 * codebase convention that the array end is the top). `findCardSource` scans
 * every zone and throws when the card is in none of them, mirroring the real
 * implementation.
 */
const makeCardSourceControllerStub = () => {
  const store = new Map<string, CardId[]>();
  const key = (location: string, playerId?: PlayerId) => `${location}:${playerId ?? ''}`;

  const place = (cardId: CardId, location: string, playerId?: PlayerId) => {
    const k = key(location, playerId);
    if (!store.has(k)) store.set(k, []);
    store.get(k)!.push(cardId);
  };

  const controller = {
    findCardSource: (cardId: CardId) => {
      for (const [k, source] of store) {
        const idx = source.indexOf(cardId);
        if (idx !== -1) {
          const [sourceKey, playerToken] = k.split(':');
          const playerId = playerToken ? Number(playerToken) : undefined;
          return { sourceKey, source, index: idx, playerId };
        }
      }
      throw new Error(`[test stub] source for card ${cardId} not found`);
    },
    getSource: (location: string, playerId?: PlayerId) => {
      const k = key(location, playerId);
      if (!store.has(k)) store.set(k, []);
      return store.get(k)!;
    },
  } as unknown as CardSourceController;

  return { controller, place, store };
};

/** Recording ReactionManager: tracks trigger/lifecycle calls so tests can assert on-trash fan-out. */
const makeReactionManagerStub = () => {
  const triggers: string[] = [];
  const lifecycleEvents: string[] = [];
  const reactionManager = {
    runTrigger: async (args: { trigger: { eventType: string } }) => {
      triggers.push(args.trigger.eventType);
      return undefined;
    },
    runCardLifecycleEvent: async (event: string) => {
      lifecycleEvents.push(event);
      return undefined;
    },
    runGameLifecycleEvent: async () => undefined,
    cleanupDurationTriggers: () => undefined,
  } as unknown as ReactionManager;
  return { reactionManager, triggers, lifecycleEvents };
};

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

/**
 * Assembles a GameActionController with stub collaborators sufficient to
 * drive moveCard/trashCard's lose-track guard.
 */
const makeController = (opts: { match?: Partial<Match>; extraCards?: Card[] } = {}) => {
  const { loggerService } = createTestLogger();
  const match = makeMatch(opts.match);
  const card = new Card({ ...createTestCard(), id: 1 });
  const cardLibraryEntries: [CardId, Card][] = [
    [card.id, card],
    ...(opts.extraCards ?? []).map(c => [c.id, c] as [CardId, Card]),
  ];
  const cardLibrary = makeCardLibraryStub(new Map(cardLibraryEntries));
  const { controller: cardSourceController, place, store } = makeCardSourceControllerStub();
  const { reactionManager, triggers, lifecycleEvents } = makeReactionManagerStub();
  const addLogEntryCalls: unknown[] = [];
  const logManager = { addLogEntry: (entry: unknown) => addLogEntryCalls.push(entry) } as unknown as LogManager;
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
    {} as unknown as BuyOptionsResolver,
    {} as unknown as PromptService,
    { run: async () => undefined } as unknown as ActionService,
    {} as unknown as CardEffectContextFactory,
    {} as unknown as TokenRegistryService,
    {} as unknown as RngService,
    loggerService,
    {} as unknown as PromptAbortRegistry,
  );

  return { controller, match, card, place, store, triggers, lifecycleEvents, addLogEntryCalls };
};

// ---------------------------------------------------------------------------
// moveCard: expectedFrom
// ---------------------------------------------------------------------------

Deno.test('moveCard with matching expectedFrom (location + owner) moves card and returns old location', async () => {
  const { controller, card, place } = makeController();
  place(card.id, 'playArea', PLAYER_ID);

  const result = await controller.moveCard({
    cardId: card.id,
    to: { location: 'trash' },
    expectedFrom: { location: 'playArea', playerId: PLAYER_ID },
  });

  assertEquals(result, { location: 'playArea', playerId: PLAYER_ID, emptiedSupplyPileKey: undefined });
});

Deno.test('moveCard with mismatched expectedFrom location returns undefined, leaves source arrays alone', async () => {
  const { controller, card, place, store } = makeController();
  place(card.id, 'playerDiscard', PLAYER_ID);

  const result = await controller.moveCard({
    cardId: card.id,
    to: { location: 'trash' },
    expectedFrom: { location: 'playArea', playerId: PLAYER_ID },
  });

  assertEquals(result, undefined);
  // The card must still be in its original discard array; nothing spliced.
  assertEquals(store.get(`playerDiscard:${PLAYER_ID}`), [card.id]);
});

Deno.test('moveCard with requireTop fails when the card is buried and succeeds when it is on top', async () => {
  const buriedCard = new Card({ ...createTestCard(), id: 2 });
  const coveringCard = new Card({ ...createTestCard(), id: 3 });
  const { controller, card, place } = makeController({ extraCards: [buriedCard, coveringCard] });
  // Push the buried card first, then the target card, then cover the target
  // card by pushing another card on top (array end = top of pile).
  place(buriedCard.id, 'playerDeck', PLAYER_ID);
  place(card.id, 'playerDeck', PLAYER_ID);
  place(coveringCard.id, 'playerDeck', PLAYER_ID);

  const buriedResult = await controller.moveCard({
    cardId: card.id,
    to: { location: 'trash' },
    expectedFrom: { location: 'playerDeck', playerId: PLAYER_ID, requireTop: true },
  });
  assertEquals(buriedResult, undefined);

  // Now the covering card is on top; requireTop should succeed for it.
  const topResult = await controller.moveCard({
    cardId: coveringCard.id,
    to: { location: 'trash' },
    expectedFrom: { location: 'playerDeck', playerId: PLAYER_ID, requireTop: true },
  });
  assertEquals(topResult, { location: 'playerDeck', playerId: PLAYER_ID, emptiedSupplyPileKey: undefined });
});

// ---------------------------------------------------------------------------
// trashCard: expectedFrom
// ---------------------------------------------------------------------------

Deno.test('trashCard with mismatched expectedFrom resolves false and skips all trash side effects', async () => {
  const { controller, match, card, place, triggers, lifecycleEvents, addLogEntryCalls } = makeController();
  // Card is already in the trash (e.g. a Throne Room replay's second resolution).
  place(card.id, 'trash');

  const trashed = await controller.trashCard({
    cardId: card.id,
    playerId: PLAYER_ID,
    expectedFrom: { location: 'playArea', playerId: PLAYER_ID },
  });

  assertEquals(trashed, false);
  assertEquals(match.stats.trashedCards[card.id], undefined);
  assertEquals(match.stats.trashedCardsByTurn, []);
  assertEquals(triggers.includes('cardTrashed'), false);
  assertEquals(lifecycleEvents.includes('onTrashed'), false);
  assertEquals(addLogEntryCalls.length, 0);
});

Deno.test('trashCard without expectedFrom keeps legacy behavior: side effects fire and it resolves true', async () => {
  const { controller, match, card, place, triggers, lifecycleEvents, addLogEntryCalls } = makeController();
  place(card.id, 'playArea', PLAYER_ID);

  const trashed = await controller.trashCard({
    cardId: card.id,
    playerId: PLAYER_ID,
  });

  assertEquals(trashed, true);
  assertEquals(match.stats.trashedCards[card.id] !== undefined, true);
  assertEquals(match.stats.trashedCardsByTurn[0], [card.id]);
  assertEquals(triggers.includes('cardTrashed'), true);
  assertEquals(lifecycleEvents.includes('onTrashed'), true);
  assertEquals(addLogEntryCalls.length, 1);
});
