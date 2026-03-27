import { assertEquals, assertStrictEquals } from '@std/assert';
import { createTestPlayer } from '../../testing/create-test-player.ts';
import { PlayerSessionService } from '../player-session-service.ts';

Deno.test('PlayerSessionService.selectOwnerOnJoin selects joined player when no current owner exists', () => {
  const playerSessionService = new PlayerSessionService();
  const joinedPlayer = createTestPlayer({ id: 5 });

  const result = playerSessionService.selectOwnerOnJoin(undefined, joinedPlayer);

  assertStrictEquals(result, joinedPlayer);
});

Deno.test('PlayerSessionService.selectOwnerOnJoin replaces computer owner with human join', () => {
  const playerSessionService = new PlayerSessionService();
  const computerOwner = createTestPlayer({ id: 1, isComputer: true });
  const joinedPlayer = createTestPlayer({ id: 2, isComputer: false });

  const result = playerSessionService.selectOwnerOnJoin(computerOwner, joinedPlayer);

  assertStrictEquals(result, joinedPlayer);
});

Deno.test('PlayerSessionService.selectOwnerOnJoin keeps current human owner', () => {
  const playerSessionService = new PlayerSessionService();
  const currentOwner = createTestPlayer({ id: 1, isComputer: false });
  const joinedPlayer = createTestPlayer({ id: 2, isComputer: false });

  const result = playerSessionService.selectOwnerOnJoin(currentOwner, joinedPlayer);

  assertStrictEquals(result, currentOwner);
});

Deno.test('PlayerSessionService detects connected/disconnected human players and owner replacement', () => {
  const playerSessionService = new PlayerSessionService();
  const players = [
    createTestPlayer({ id: 1, connected: true, isComputer: false }),
    createTestPlayer({ id: 2, connected: false, isComputer: false }),
    createTestPlayer({ id: 3, connected: true, isComputer: true }),
  ];

  assertEquals(playerSessionService.hasConnectedHumanPlayers(players), true);
  assertEquals(playerSessionService.hasDisconnectedHumanPlayers(players), true);
  assertStrictEquals(playerSessionService.findReplacementOwner(players), players[0]);
  assertEquals(playerSessionService.findReplacementOwner(players, 1), undefined);
});
