import { assertEquals } from '@std/assert';
import { MatchUndoService } from '../undo/match-undo-service.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';
import type { Match } from 'shared/types/index.ts';
import type { MatchCardLibrary } from '../match-card-library.ts';
import type { CardSourceController } from '../card-source-controller.ts';
import type { CardInstanceFactoryService } from '../card-instance-factory-service.ts';
import type { ReactionManager } from '../reactions/reaction-manager.ts';
import type { CardPriceRulesController } from '../card-price-rules-controller.ts';
import type { PlayRulesController } from '../play-rules-controller.ts';
import type { LogManager } from '../log-manager.ts';

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

/** Minimal Match-like plain object that structuredClone can round-trip. */
const makeMatch = (initial: Record<string, unknown> = {}): Match =>
  ({ turnNumber: 1, cardSources: {}, cardSourceTagMap: {}, ...initial } as unknown as Match);

type Stubs = {
  match: Match;
  cardLibrary: MatchCardLibrary;
  cardSourceController: CardSourceController;
  cardInstanceFactory: CardInstanceFactoryService;
  reactionManager: ReactionManager;
  cardPriceController: CardPriceRulesController;
  playRulesController: PlayRulesController;
  logManager: LogManager;
};

/** Builds minimal no-op stubs for every MatchUndoService dependency. */
const makeStubs = (matchOverrides: Record<string, unknown> = {}): Stubs => ({
  match: makeMatch(matchOverrides),
  cardLibrary: {
    getAllCards: () => ({}),
    getAllCardsAsArray: () => [],
    removeCard: () => {},
    tryGetCard: () => undefined,
    addCard: () => {},
  } as unknown as MatchCardLibrary,
  cardSourceController: {
    rebuildFromMatch: () => {},
  } as unknown as CardSourceController,
  cardInstanceFactory: {
    getCardCount: () => 0,
    setCardCount: () => {},
    rehydrateCard: (c: unknown) => c,
  } as unknown as CardInstanceFactoryService,
  reactionManager: {
    snapshotReactions: () => [],
    snapshotDurationTriggers: () => new Map(),
    restoreReactions: () => {},
  } as unknown as ReactionManager,
  cardPriceController: {
    snapshotRules: () => ({}),
    restoreRules: () => {},
  } as unknown as CardPriceRulesController,
  playRulesController: {
    snapshotRules: () => [],
    restoreRules: () => {},
  } as unknown as PlayRulesController,
  logManager: {
    getHistoryLength: () => 0,
    truncateHistory: () => {},
  } as unknown as LogManager,
});

/** Constructs a MatchUndoService wired to the given stubs. */
const makeService = (stubs: Stubs): MatchUndoService => {
  const { loggerService } = createTestLogger();
  return new MatchUndoService(
    stubs.match,
    stubs.cardLibrary,
    stubs.cardSourceController,
    stubs.cardInstanceFactory,
    stubs.reactionManager,
    stubs.cardPriceController,
    stubs.playRulesController,
    stubs.logManager,
    loggerService,
  );
};

// Shorthand for the common one-shot setup.
const makeDefault = () => {
  const stubs = makeStubs();
  return { stubs, service: makeService(stubs) };
};

// ---------------------------------------------------------------------------
// canUndo / getSnapshotCount
// ---------------------------------------------------------------------------

Deno.test('MatchUndoService.canUndo returns false on a fresh service', () => {
  const { service } = makeDefault();
  assertEquals(service.canUndo(), false);
});

Deno.test('MatchUndoService.canUndo returns true after pushSnapshot', () => {
  const { service } = makeDefault();
  service.pushSnapshot(null);
  assertEquals(service.canUndo(), true);
});

Deno.test('MatchUndoService.getSnapshotCount increments with each push', () => {
  const { service } = makeDefault();
  assertEquals(service.getSnapshotCount(), 0);
  service.pushSnapshot(null);
  assertEquals(service.getSnapshotCount(), 1);
  service.pushSnapshot(1);
  assertEquals(service.getSnapshotCount(), 2);
});

// ---------------------------------------------------------------------------
// canUndoForPlayer
// ---------------------------------------------------------------------------

Deno.test('MatchUndoService.canUndoForPlayer returns false when stack is empty', () => {
  const { service } = makeDefault();
  assertEquals(service.canUndoForPlayer(1), false);
});

Deno.test('MatchUndoService.canUndoForPlayer returns true when the player has a snapshot', () => {
  const { service } = makeDefault();
  service.pushSnapshot(1);
  assertEquals(service.canUndoForPlayer(1), true);
});

Deno.test('MatchUndoService.canUndoForPlayer returns false when only another player has snapshots', () => {
  const { service } = makeDefault();
  service.pushSnapshot(2);
  assertEquals(service.canUndoForPlayer(1), false);
});

Deno.test('MatchUndoService.canUndoForPlayer returns true even when the player snapshot is not on top', () => {
  const { service } = makeDefault();
  service.pushSnapshot(1); // player 1 below
  service.pushSnapshot(2); // player 2 on top
  assertEquals(service.canUndoForPlayer(1), true);
});

Deno.test('MatchUndoService.canUndoForPlayer returns false for a system snapshot (null initiator)', () => {
  const { service } = makeDefault();
  service.pushSnapshot(null);
  assertEquals(service.canUndoForPlayer(1), false);
});

// ---------------------------------------------------------------------------
// Bounded stack
// ---------------------------------------------------------------------------

Deno.test('MatchUndoService bounded stack caps at 50 snapshots', () => {
  const { service } = makeDefault();
  for (let i = 0; i < 51; i++) {
    service.pushSnapshot(1);
  }
  assertEquals(service.getSnapshotCount(), 50);
});

Deno.test('MatchUndoService bounded stack evicts the oldest snapshot when full', () => {
  const { service } = makeDefault();
  // Fill the stack with player 1 snapshots (50 slots).
  service.pushSnapshot(1); // index 0 — will be evicted on the 51st push
  for (let i = 1; i < 50; i++) {
    service.pushSnapshot(2);
  }
  // Stack is full: [P1, P2, P2, ...P2] — 50 items.
  // One more push for player 2 shifts out the oldest (player 1's snapshot).
  service.pushSnapshot(2);

  assertEquals(service.getSnapshotCount(), 50);
  assertEquals(service.canUndoForPlayer(1), false);
  assertEquals(service.canUndoForPlayer(2), true);
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

Deno.test('MatchUndoService.clear empties the snapshot stack', () => {
  const { service } = makeDefault();
  service.pushSnapshot(1);
  service.pushSnapshot(2);
  service.clear();
  assertEquals(service.getSnapshotCount(), 0);
  assertEquals(service.canUndo(), false);
});

// ---------------------------------------------------------------------------
// restoreLatest
// ---------------------------------------------------------------------------

Deno.test('MatchUndoService.restoreLatest returns null when stack is empty', async () => {
  const { service } = makeDefault();
  const result = await service.restoreLatest(false);
  assertEquals(result, null);
});

Deno.test('MatchUndoService.restoreLatest pops the top snapshot and restores match state', async () => {
  const stubs = makeStubs({ turnNumber: 10 });
  const service = makeService(stubs);
  const m = stubs.match as unknown as Record<string, unknown>;

  service.pushSnapshot(null); // captures turnNumber=10

  m.turnNumber = 99;
  await service.restoreLatest(false);

  assertEquals(m.turnNumber, 10);
  assertEquals(service.getSnapshotCount(), 0);
});

Deno.test('MatchUndoService.restoreLatest with actionInFlight=true waits for signalUnwindComplete', async () => {
  const { service } = makeDefault();
  service.pushSnapshot(null);

  let settled = false;
  const restorePromise = service.restoreLatest(true).then(() => {
    settled = true;
  });

  // Still awaiting the unwind signal.
  assertEquals(settled, false);

  service.signalUnwindComplete();
  await restorePromise;

  assertEquals(settled, true);
});

// ---------------------------------------------------------------------------
// restoreLatestForPlayer
// ---------------------------------------------------------------------------

Deno.test('MatchUndoService.restoreLatestForPlayer returns null when the player has no snapshot', async () => {
  const { service } = makeDefault();
  service.pushSnapshot(2);
  const result = await service.restoreLatestForPlayer(1, false);
  assertEquals(result, null);
  assertEquals(service.getSnapshotCount(), 1); // unchanged
});

Deno.test('MatchUndoService.restoreLatestForPlayer restores the player own snapshot', async () => {
  const stubs = makeStubs({ turnNumber: 10 });
  const service = makeService(stubs);
  const m = stubs.match as unknown as Record<string, unknown>;

  service.pushSnapshot(1); // captures turnNumber=10

  m.turnNumber = 99;
  await service.restoreLatestForPlayer(1, false);

  assertEquals(m.turnNumber, 10);
  assertEquals(service.getSnapshotCount(), 0);
});

Deno.test('MatchUndoService.restoreLatestForPlayer finds player snapshot that is not on top', async () => {
  const stubs = makeStubs({ turnNumber: 1 });
  const service = makeService(stubs);
  const m = stubs.match as unknown as Record<string, unknown>;

  service.pushSnapshot(1); // idx 0 — P1, tn=1

  m.turnNumber = 2;
  service.pushSnapshot(2); // idx 1 — P2, tn=2  ← target when restoring P2

  m.turnNumber = 3;
  service.pushSnapshot(1); // idx 2 — P1, tn=3  ← above target; should be discarded

  m.turnNumber = 99;
  await service.restoreLatestForPlayer(2, false);

  // Restored from idx 1 which captured turnNumber=2.
  assertEquals(m.turnNumber, 2);
  // splice(1) removed idx 1 and idx 2; only idx 0 (P1) survives.
  assertEquals(service.getSnapshotCount(), 1);
  assertEquals(service.canUndoForPlayer(1), true);
  assertEquals(service.canUndoForPlayer(2), false);
});

Deno.test('MatchUndoService.restoreLatestForPlayer uses the most recent snapshot for that player', async () => {
  const stubs = makeStubs({ turnNumber: 1 });
  const service = makeService(stubs);
  const m = stubs.match as unknown as Record<string, unknown>;

  service.pushSnapshot(1); // idx 0 — P1, tn=1

  m.turnNumber = 2;
  service.pushSnapshot(1); // idx 1 — P1, tn=2  ← most recent for P1

  m.turnNumber = 99;
  await service.restoreLatestForPlayer(1, false);

  // Most recent P1 snapshot is at idx 1 (tn=2); splice(1) leaves idx 0.
  assertEquals(m.turnNumber, 2);
  assertEquals(service.getSnapshotCount(), 1);
  assertEquals(service.canUndoForPlayer(1), true);
});

Deno.test('MatchUndoService.restoreLatestForPlayer leaves snapshots below the target intact', async () => {
  const stubs = makeStubs({ turnNumber: 5 });
  const service = makeService(stubs);
  const m = stubs.match as unknown as Record<string, unknown>;

  service.pushSnapshot(1); // idx 0 — P1, tn=5

  m.turnNumber = 10;
  service.pushSnapshot(2); // idx 1 — P2, tn=10  ← target when restoring P2

  m.turnNumber = 15;
  service.pushSnapshot(1); // idx 2 — P1, tn=15

  m.turnNumber = 99;
  await service.restoreLatestForPlayer(2, false);

  // splice(1) removes idx 1 and idx 2; idx 0 (P1 at tn=5) is untouched.
  assertEquals(service.getSnapshotCount(), 1);
  assertEquals(service.canUndoForPlayer(1), true);
});

Deno.test('MatchUndoService.restoreLatestForPlayer with actionInFlight=true waits for signalUnwindComplete', async () => {
  const { service } = makeDefault();
  service.pushSnapshot(1);

  let settled = false;
  const promise = service.restoreLatestForPlayer(1, true).then(() => {
    settled = true;
  });

  assertEquals(settled, false);
  service.signalUnwindComplete();
  await promise;
  assertEquals(settled, true);
});

// ---------------------------------------------------------------------------
// signalUnwindComplete
// ---------------------------------------------------------------------------

Deno.test('MatchUndoService.signalUnwindComplete is a no-op when no unwind barrier is pending', () => {
  const { service } = makeDefault();
  // Should not throw or alter state.
  service.signalUnwindComplete();
  assertEquals(service.canUndo(), false);
});
