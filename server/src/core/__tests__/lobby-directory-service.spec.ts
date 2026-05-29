import { assertEquals } from '@std/assert';
import { LobbyDirectoryService } from '../lobby-directory-service.ts';
import { LoggerService } from '../logger-service.ts';

/**
 * These tests cover the reconnect-routing fix: when a session reconnects into a
 * game whose match has already started, `joinLobbyGame` must emit
 * `joinedLobbyGame` with `matchInProgress = true` so the client routes to
 * /match instead of the pre-match /configuration screen. A game still in
 * configuration must emit `matchInProgress = false`.
 */

// Silences logger output during tests.
const makeLoggerStub = (): LoggerService =>
  ({
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  }) as unknown as LoggerService;

// Records emit() calls so a test can inspect the joinedLobbyGame payload.
interface FakeSocket {
  id: string;
  emitted: Array<{ event: string; args: unknown[] }>;
  emit: (event: string, ...args: unknown[]) => boolean;
  join: (room: string) => void;
  leave: (room: string) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
}

const makeFakeSocket = (id = 'sock-1'): FakeSocket => {
  const socket: FakeSocket = {
    id,
    emitted: [],
    emit: (event, ...args) => {
      socket.emitted.push({ event, args });
      return true;
    },
    join: () => {},
    leave: () => {},
    on: () => {},
  };
  return socket;
};

// Minimal Socket.IO server stub: `.in(room).emit(...)` is a no-op sink.
const makeIoStub = () =>
  ({
    in: () => ({ emit: () => {} }),
    emit: () => {},
  }) as unknown as ConstructorParameters<typeof LobbyDirectoryService>[0];

// Builds the slice of the Game surface that joinLobbyGame + handleGameStateChanged touch.
const makeGameStub = (gameId: string, matchStarted: boolean) =>
  ({
    id: gameId,
    matchStarted,
    players: [],
    owner: undefined,
    hasSession: () => true,
    addPlayer: () => ({ status: 'accepted', playerId: 1 }),
    getDebugRuntimeContext: () => ({}),
    getConnectedHumanCount: () => 1,
    getConnectedPlayerCount: () => 1,
  });

/**
 * Creates a service with one injected game record and a session already mapped
 * to it, then returns the service plus the gameId. `matchStarted` controls
 * whether the injected game is mid-match or still in configuration.
 */
function setupReconnectScenario(matchStarted: boolean): { service: LobbyDirectoryService; gameId: string } {
  const expansionSearchService = {
    getSelectableSearchCatalog: () => ({}),
  } as unknown as ConstructorParameters<typeof LobbyDirectoryService>[3];
  const userStore = {
    getByUsername: () => Promise.resolve(undefined),
  } as unknown as ConstructorParameters<typeof LobbyDirectoryService>[5];
  const gameScopeFactory = {} as unknown as ConstructorParameters<typeof LobbyDirectoryService>[2];

  const service = new LobbyDirectoryService(
    makeIoStub(),
    6,
    gameScopeFactory,
    expansionSearchService,
    makeLoggerStub(),
    userStore,
  );

  const gameId = 'game-test';
  const record = {
    gameId,
    gameName: 'Test Game',
    game: makeGameStub(gameId, matchStarted),
    dispose: () => {},
    bannedSessionIds: new Set<string>(),
    // Started games are not listed in the lobby; configuring games are.
    listedInLobby: !matchStarted,
  };

  // Inject private state to drive the reconnect path through joinLobbyGame.
  const internals = service as unknown as {
    games: Map<string, unknown>;
    sessionToGameId: Map<string, string>;
  };
  internals.games.set(gameId, record);
  internals.sessionToGameId.set('session-1', gameId);

  return { service, gameId };
}

Deno.test('LobbyDirectoryService: reconnect into a started match emits joinedLobbyGame with matchInProgress=true', () => {
  const { service, gameId } = setupReconnectScenario(true);
  const socket = makeFakeSocket();

  service.registerConnection('session-1', socket as never, 'user1');

  const joined = socket.emitted.find(entry => entry.event === 'joinedLobbyGame');
  assertEquals(joined?.args, [gameId, true]);
});

Deno.test('LobbyDirectoryService: joining a game still in configuration emits joinedLobbyGame with matchInProgress=false', () => {
  const { service, gameId } = setupReconnectScenario(false);
  const socket = makeFakeSocket();

  service.registerConnection('session-1', socket as never, 'user1');

  const joined = socket.emitted.find(entry => entry.event === 'joinedLobbyGame');
  assertEquals(joined?.args, [gameId, false]);
});
