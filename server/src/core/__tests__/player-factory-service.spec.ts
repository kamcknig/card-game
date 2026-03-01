import { assertEquals } from '@std/assert';
import type { AppSocket } from '@server-types/index.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';
import { PlayerFactoryService } from '../player-factory-service.ts';

Deno.test('PlayerFactoryService.createPlayer creates incrementing human players from socket sessions', () => {
  const { entries, loggerService } = createTestLogger();
  const playerFactoryService = new PlayerFactoryService(loggerService);

  const first = playerFactoryService.createPlayer('session-1', { id: 'socket-1' } as AppSocket);
  const second = playerFactoryService.createPlayer('session-2', { id: 'socket-2' } as AppSocket);

  assertEquals(first.id, 1);
  assertEquals(first.name, 'Player 1');
  assertEquals(first.sessionId, 'session-1');
  assertEquals(first.socketId, 'socket-1');
  assertEquals(first.connected, false);
  assertEquals(first.ready, false);
  assertEquals(first.isComputer, false);

  assertEquals(second.id, 2);
  assertEquals(second.name, 'Player 2');
  assertEquals(entries.filter(entry => entry.level === 'info').length, 2);
});

Deno.test('PlayerFactoryService.createComputerPlayer creates incrementing ready/connected bots', () => {
  const { entries, loggerService } = createTestLogger();
  const playerFactoryService = new PlayerFactoryService(loggerService);

  const computer = playerFactoryService.createComputerPlayer();

  assertEquals(computer.id, 1);
  assertEquals(computer.name, 'Computer 1');
  assertEquals(computer.sessionId, 'computer:1');
  assertEquals(computer.socketId, '');
  assertEquals(computer.connected, true);
  assertEquals(computer.ready, true);
  assertEquals(computer.isComputer, true);
  assertEquals(entries.filter(entry => entry.level === 'info').length, 1);
});
