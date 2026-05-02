import { assertEquals } from '@std/assert';
import { MatchUndoVoteService } from '../undo/match-undo-vote-service.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';
import { createTestPlayer } from '../../testing/create-test-player.ts';
import type { AppSocket } from '@server-types/index.ts';
import type { Match, Player, PlayerId } from 'shared/types/index.ts';
import type { MatchUndoService } from '../undo/match-undo-service.ts';
import type { PromptAbortRegistry } from '../undo/prompt-abort-registry.ts';
import type { LogManager } from '../log-manager.ts';

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

/** Emitted event record for assertions on a mock socket. */
type EmittedEvent = { event: string; args: unknown[] };

/** Creates a socket stub that records all emit calls. */
const makeMockSocket = () => {
  const emitted: EmittedEvent[] = [];
  const socket = {
    emit: (event: string, ...args: unknown[]) => emitted.push({ event, args }),
  } as unknown as AppSocket;
  return { socket, emitted };
};

/** Minimal Match wrapper containing only the fields read by the vote service. */
const makeMatch = (players: Player[]): Match =>
  ({ players, currentPlayerTurnIndex: 0 } as unknown as Match);

/** Configurable stub for MatchUndoService. */
const makeUndoServiceStub = (opts: {
  canUndo?: boolean;
  canUndoForPlayer?: boolean;
  restoreReturnsNull?: boolean;
} = {}): MatchUndoService => ({
  canUndo: () => opts.canUndo ?? true,
  canUndoForPlayer: (_id: PlayerId) => opts.canUndoForPlayer ?? true,
  restoreLatestForPlayer: async (playerId: PlayerId, _inFlight: boolean) => {
    if (opts.restoreReturnsNull) return null;
    return { initiatingPlayerId: playerId } as unknown;
  },
} as unknown as MatchUndoService);

/** No-op PromptAbortRegistry stub. */
const makePromptAbortStub = (hasInFlight = false): PromptAbortRegistry => ({
  hasInFlight: () => hasInFlight,
  abortAll: () => {},
} as unknown as PromptAbortRegistry);

/** No-op LogManager stub. */
const makeLogManagerStub = (): LogManager => ({
  addLogEntry: () => {},
  flushQueue: () => {},
  getHistory: () => [],
} as unknown as LogManager);

/**
 * Assembles a MatchUndoVoteService with the given players and sockets, then
 * binds no-op controller methods (with an optional isGameEnded flag). Returns
 * the service together with the per-player emitted event arrays.
 */
const makeVoteService = (opts: {
  players?: Player[];
  sockets?: Map<PlayerId, AppSocket>;
  undoOpts?: ConstructorParameters<typeof Object>[0];
  isGameEnded?: boolean;
  restoreReturnsNull?: boolean;
  hasInFlightPrompt?: boolean;
} = {}) => {
  const players = opts.players ?? [];
  const sockets = opts.sockets ?? new Map<PlayerId, AppSocket>();
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch(players),
    makeUndoServiceStub({
      canUndo: (opts as Record<string, unknown>).canUndo as boolean | undefined ?? true,
      canUndoForPlayer: (opts as Record<string, unknown>).canUndoForPlayer as boolean | undefined ?? true,
      restoreReturnsNull: opts.restoreReturnsNull,
    }),
    makePromptAbortStub(opts.hasInFlightPrompt),
    makeLogManagerStub(),
    loggerService,
  );

  const patchCalls: Match[] = [];
  service.bindControllerMethods(
    () => ({} as Match),
    (prev: Match) => patchCalls.push(prev),
    () => opts.isGameEnded ?? false,
    () => {},
  );

  return { service, patchCalls };
};

// ---------------------------------------------------------------------------
// Helper: build a player + socket pair and wire them together.
// ---------------------------------------------------------------------------

const makePlayerAndSocket = (id: number, playerOpts: Partial<Parameters<typeof createTestPlayer>[0]> = {}) => {
  const player = createTestPlayer({ id, ...playerOpts });
  const { socket, emitted } = makeMockSocket();
  return { player, socket, emitted };
};

// ---------------------------------------------------------------------------
// hasActiveVote
// ---------------------------------------------------------------------------

Deno.test('MatchUndoVoteService.hasActiveVote returns false initially', () => {
  const { service } = makeVoteService();
  assertEquals(service.hasActiveVote(), false);
});

// ---------------------------------------------------------------------------
// requestUndo — rejection paths
// ---------------------------------------------------------------------------

Deno.test('MatchUndoVoteService.requestUndo emits no-snapshot when the undo stack is empty', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const sockets = new Map([[p1.id, s1]]);

  const { service } = makeVoteService({ players: [p1], sockets, canUndo: false } as Record<string, unknown>);
  // Override opts manually since makeVoteService reads from loose opts
  // Re-create with the explicit stub to avoid the helper's default
  const { loggerService } = createTestLogger();
  const explicit = new MatchUndoVoteService(
    sockets,
    makeMatch([p1]),
    makeUndoServiceStub({ canUndo: false }),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  explicit.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await explicit.requestUndo(1);

  const outcome = e1.find(e => e.event === 'undoCompleted');
  assertEquals(outcome?.args[0], { ok: false, reason: 'no-snapshot' });
});

Deno.test('MatchUndoVoteService.requestUndo emits not-your-action when player has no snapshot', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const sockets = new Map([[p1.id, s1]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1]),
    makeUndoServiceStub({ canUndo: true, canUndoForPlayer: false }),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);

  const outcome = e1.find(e => e.event === 'undoCompleted');
  assertEquals(outcome?.args[0], { ok: false, reason: 'not-your-action' });
});

Deno.test('MatchUndoVoteService.requestUndo emits game-ended when the match has ended', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const sockets = new Map([[p1.id, s1]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => true, () => {});

  await service.requestUndo(1);

  const outcome = e1.find(e => e.event === 'undoCompleted');
  assertEquals(outcome?.args[0], { ok: false, reason: 'game-ended' });
});

Deno.test('MatchUndoVoteService.requestUndo emits already-in-progress while a vote is active', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2 } = makePlayerAndSocket(2);
  const sockets = new Map([[p1.id, s1], [p2.id, s2]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  // First request opens a vote (P2 is a pending voter — no auto-approve).
  await service.requestUndo(1);

  // Second request while the vote is open.
  await service.requestUndo(1);

  const lastOutcome = e1.filter(e => e.event === 'undoCompleted').at(-1);
  assertEquals(lastOutcome?.args[0], { ok: false, reason: 'already-in-progress' });
  assertEquals(service.hasActiveVote(), true);
});

// ---------------------------------------------------------------------------
// requestUndo — auto-approve paths
// ---------------------------------------------------------------------------

Deno.test('MatchUndoVoteService.requestUndo auto-approves when originator is the only human', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const sockets = new Map([[p1.id, s1]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);

  const outcome = e1.find(e => e.event === 'undoCompleted');
  assertEquals(outcome?.args[0], { ok: true, by: 1 });
  assertEquals(service.hasActiveVote(), false);
});

Deno.test('MatchUndoVoteService.requestUndo auto-approves when all other players are bots', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2 } = makePlayerAndSocket(2, { isComputer: true });
  const sockets = new Map([[p1.id, s1], [p2.id, s2]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);

  const outcome = e1.find(e => e.event === 'undoCompleted');
  assertEquals(outcome?.args[0], { ok: true, by: 1 });
});

Deno.test('MatchUndoVoteService.requestUndo auto-approves when all other humans are disconnected', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2 } = makePlayerAndSocket(2, { connected: false });
  const sockets = new Map([[p1.id, s1], [p2.id, s2]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);

  // P2 is disconnected, so no undoVoteRequested is emitted to them.
  assertEquals(e1.find(e => e.event === 'undoCompleted')?.args[0], { ok: true, by: 1 });
});

// ---------------------------------------------------------------------------
// requestUndo — voter broadcast
// ---------------------------------------------------------------------------

Deno.test('MatchUndoVoteService.requestUndo broadcasts undoVoteRequested to all other connected humans', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2, emitted: e2 } = makePlayerAndSocket(2);
  const { player: p3, socket: s3, emitted: e3 } = makePlayerAndSocket(3);
  const sockets = new Map([[p1.id, s1], [p2.id, s2], [p3.id, s3]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2, p3]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);

  // P2 and P3 should receive the vote request carrying the originator id.
  assertEquals(e2.find(e => e.event === 'undoVoteRequested')?.args[0], 1);
  assertEquals(e3.find(e => e.event === 'undoVoteRequested')?.args[0], 1);
  // The originator never receives undoVoteRequested.
  assertEquals(e1.filter(e => e.event === 'undoVoteRequested').length, 0);
});

// ---------------------------------------------------------------------------
// registerVote — deny
// ---------------------------------------------------------------------------

Deno.test('MatchUndoVoteService.registerVote deny broadcasts undoCompleted denied to all players', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2, emitted: e2 } = makePlayerAndSocket(2);
  const sockets = new Map([[p1.id, s1], [p2.id, s2]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);
  await service.registerVote(2, false);

  for (const emitted of [e1, e2]) {
    const outcome = emitted.find(e => e.event === 'undoCompleted');
    assertEquals(outcome?.args[0], { ok: false, reason: 'denied', deniedBy: 2 });
  }
  assertEquals(service.hasActiveVote(), false);
});

// ---------------------------------------------------------------------------
// registerVote — approve
// ---------------------------------------------------------------------------

Deno.test('MatchUndoVoteService.registerVote approve from the last voter completes the undo', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2, emitted: e2 } = makePlayerAndSocket(2);
  const sockets = new Map([[p1.id, s1], [p2.id, s2]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);
  await service.registerVote(2, true);

  for (const emitted of [e1, e2]) {
    assertEquals(emitted.find(e => e.event === 'undoCompleted')?.args[0], { ok: true, by: 1 });
  }
  assertEquals(service.hasActiveVote(), false);
});

Deno.test('MatchUndoVoteService.registerVote approve from a non-last voter keeps the vote open', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2 } = makePlayerAndSocket(2);
  const { player: p3, socket: s3 } = makePlayerAndSocket(3);
  const sockets = new Map([[p1.id, s1], [p2.id, s2], [p3.id, s3]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2, p3]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);
  await service.registerVote(2, true); // P3 still pending

  assertEquals(e1.filter(e => e.event === 'undoCompleted').length, 0);
  assertEquals(service.hasActiveVote(), true);
});

Deno.test('MatchUndoVoteService.registerVote is a no-op when no vote is active', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const sockets = new Map([[p1.id, s1]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.registerVote(1, false);

  assertEquals(e1.length, 0);
});

Deno.test('MatchUndoVoteService.registerVote from a non-voter is ignored', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2 } = makePlayerAndSocket(2);
  const sockets = new Map([[p1.id, s1], [p2.id, s2]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);
  await service.registerVote(99, false); // player 99 is not a voter

  assertEquals(service.hasActiveVote(), true);
  assertEquals(e1.filter(e => e.event === 'undoCompleted').length, 0);
});

// ---------------------------------------------------------------------------
// cancelByOriginator
// ---------------------------------------------------------------------------

Deno.test('MatchUndoVoteService.cancelByOriginator broadcasts cancelled to all players', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2, emitted: e2 } = makePlayerAndSocket(2);
  const sockets = new Map([[p1.id, s1], [p2.id, s2]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);
  service.cancelByOriginator(1);

  for (const emitted of [e1, e2]) {
    assertEquals(emitted.find(e => e.event === 'undoCompleted')?.args[0], { ok: false, reason: 'cancelled' });
  }
  assertEquals(service.hasActiveVote(), false);
});

Deno.test('MatchUndoVoteService.cancelByOriginator is a no-op for a non-originator player', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2 } = makePlayerAndSocket(2);
  const sockets = new Map([[p1.id, s1], [p2.id, s2]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);
  service.cancelByOriginator(2); // P2 is not the originator

  assertEquals(service.hasActiveVote(), true);
  assertEquals(e1.filter(e => e.event === 'undoCompleted').length, 0);
});

Deno.test('MatchUndoVoteService.cancelByOriginator is a no-op when no vote is active', () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const sockets = new Map([[p1.id, s1]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  service.cancelByOriginator(1);

  assertEquals(e1.length, 0);
});

// ---------------------------------------------------------------------------
// handlePlayerDisconnected
// ---------------------------------------------------------------------------

Deno.test('MatchUndoVoteService.handlePlayerDisconnected cancels vote when the originator disconnects', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2, emitted: e2 } = makePlayerAndSocket(2);
  const sockets = new Map([[p1.id, s1], [p2.id, s2]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);
  service.handlePlayerDisconnected(1); // originator leaves

  for (const emitted of [e1, e2]) {
    assertEquals(emitted.find(e => e.event === 'undoCompleted')?.args[0], { ok: false, reason: 'cancelled' });
  }
  assertEquals(service.hasActiveVote(), false);
});

Deno.test('MatchUndoVoteService.handlePlayerDisconnected auto-approves when the last voter disconnects', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2 } = makePlayerAndSocket(2);
  const sockets = new Map([[p1.id, s1], [p2.id, s2]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);
  service.handlePlayerDisconnected(2); // only voter leaves → auto-approve

  // _completeApproved is fired with void; let its microtasks settle.
  await new Promise(resolve => setTimeout(resolve, 0));

  assertEquals(e1.find(e => e.event === 'undoCompleted')?.args[0], { ok: true, by: 1 });
  assertEquals(service.hasActiveVote(), false);
});

Deno.test('MatchUndoVoteService.handlePlayerDisconnected keeps vote open when other voters remain', async () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const { player: p2, socket: s2 } = makePlayerAndSocket(2);
  const { player: p3, socket: s3 } = makePlayerAndSocket(3);
  const sockets = new Map([[p1.id, s1], [p2.id, s2], [p3.id, s3]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1, p2, p3]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  await service.requestUndo(1);
  service.handlePlayerDisconnected(2); // P2 leaves; P3 still pending

  assertEquals(service.hasActiveVote(), true);
  assertEquals(e1.filter(e => e.event === 'undoCompleted').length, 0);
});

Deno.test('MatchUndoVoteService.handlePlayerDisconnected is a no-op when no vote is active', () => {
  const { player: p1, socket: s1, emitted: e1 } = makePlayerAndSocket(1);
  const sockets = new Map([[p1.id, s1]]);
  const { loggerService } = createTestLogger();

  const service = new MatchUndoVoteService(
    sockets,
    makeMatch([p1]),
    makeUndoServiceStub(),
    makePromptAbortStub(),
    makeLogManagerStub(),
    loggerService,
  );
  service.bindControllerMethods(() => ({} as Match), () => {}, () => false, () => {});

  service.handlePlayerDisconnected(1);

  assertEquals(e1.length, 0);
});
