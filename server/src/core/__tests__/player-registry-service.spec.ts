import { assertEquals, assertStrictEquals } from '@std/assert';
import type { AppSocket } from '@server-types/index.ts';
import { createTestPlayer } from '../../testing/create-test-player.ts';
import { PlayerFactoryService } from '../player-factory-service.ts';
import { PlayerRegistryService } from '../player-registry-service.ts';

// Builds a minimal player-factory test double for registry service tests.
const createPlayerFactoryStub = (createdPlayer = createTestPlayer({ id: 99 })) => {
  const calls: Array<{ sessionId: string; socketId: string; username: string | undefined }> = [];
  const playerFactoryService = {
    createPlayer: (sessionId: string, socket: AppSocket, username?: string) => {
      calls.push({ sessionId, socketId: socket.id, username });
      return createdPlayer;
    },
  } as unknown as PlayerFactoryService;

  return {
    calls,
    playerFactoryService,
    createdPlayer,
  };
};

Deno.test('PlayerRegistryService accepts reconnecting existing players even at max capacity', () => {
  const existing = createTestPlayer({
    id: 1,
    sessionId: 'session-1',
    socketId: 'old-socket',
    connected: false,
    ready: false,
  });
  const players = [existing];
  const { playerFactoryService, calls } = createPlayerFactoryStub();
  const service = new PlayerRegistryService(playerFactoryService, 1);

  const result = service.registerPlayerJoin({
    players,
    sessionId: 'session-1',
    socket: { id: 'new-socket' } as AppSocket,
    matchStarted: true,
    username: 'TestPlayer',
  });

  assertEquals(result.status, 'accepted');
  if (result.status === 'accepted') {
    assertEquals(result.created, false);
    assertStrictEquals(result.player, existing);
  }
  assertEquals(existing.socketId, 'new-socket');
  assertEquals(existing.connected, true);
  assertEquals(calls.length, 0);
});

Deno.test('PlayerRegistryService rejects new joins at capacity', () => {
  const players = [createTestPlayer({ id: 1 }), createTestPlayer({ id: 2 })];
  const { playerFactoryService, calls } = createPlayerFactoryStub();
  const service = new PlayerRegistryService(playerFactoryService, 2);

  const result = service.registerPlayerJoin({
    players,
    sessionId: 'new-session',
    socket: { id: 'socket-3' } as AppSocket,
    matchStarted: false,
    username: 'TestPlayer',
  });

  assertEquals(result, { status: 'rejected_capacity' });
  assertEquals(calls.length, 0);
});

Deno.test('PlayerRegistryService rejects unknown joins when match is already started', () => {
  const players = [createTestPlayer({ id: 1 })];
  const { playerFactoryService, calls } = createPlayerFactoryStub();
  const service = new PlayerRegistryService(playerFactoryService, 6);

  const result = service.registerPlayerJoin({
    players,
    sessionId: 'new-session',
    socket: { id: 'socket-2' } as AppSocket,
    matchStarted: true,
    username: 'TestPlayer',
  });

  assertEquals(result, { status: 'rejected_started' });
  assertEquals(calls.length, 0);
});

Deno.test('PlayerRegistryService creates and appends new player for valid join', () => {
  const players = [createTestPlayer({ id: 1 })];
  const createdPlayer = createTestPlayer({ id: 2, sessionId: 'new-session', socketId: 'socket-2' });
  const { playerFactoryService, calls } = createPlayerFactoryStub(createdPlayer);
  const service = new PlayerRegistryService(playerFactoryService, 6);

  const result = service.registerPlayerJoin({
    players,
    sessionId: 'new-session',
    socket: { id: 'socket-2' } as AppSocket,
    matchStarted: false,
    username: 'NewPlayer',
  });

  assertEquals(result.status, 'accepted');
  if (result.status === 'accepted') {
    assertEquals(result.created, true);
    assertStrictEquals(result.player, createdPlayer);
  }
  assertEquals(players.includes(createdPlayer), true);
  assertEquals(calls, [{ sessionId: 'new-session', socketId: 'socket-2', username: 'NewPlayer' }]);
});

Deno.test('PlayerRegistryService mark/set helpers update players when found', () => {
  const player = createTestPlayer({ id: 1, connected: true, ready: true, name: 'Before' });
  const players = [player];
  const { playerFactoryService } = createPlayerFactoryStub();
  const service = new PlayerRegistryService(playerFactoryService, 6);

  const disconnected = service.markPlayerDisconnected(players, 1);
  const renamed = service.setPlayerName(players, 1, 'After');
  const missingDisconnect = service.markPlayerDisconnected(players, 99);
  const missingRename = service.setPlayerName(players, 99, 'None');

  assertStrictEquals(disconnected, player);
  assertEquals(player.connected, false);
  assertEquals(player.ready, false);

  assertStrictEquals(renamed, player);
  assertEquals(player.name, 'After');

  assertEquals(missingDisconnect, undefined);
  assertEquals(missingRename, undefined);
});
