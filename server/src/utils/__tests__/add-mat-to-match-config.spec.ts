import { assertEquals } from '@std/assert';
import type { ComputedMatchConfiguration } from 'shared/types/index.ts';
import type { InitializeExpansionContext } from '@server-types/index.ts';
import { createTestPlayer } from '../../testing/create-test-player.ts';
import { addMatToMatchConfig } from '../add-mat-to-match-config.ts';

Deno.test('addMatToMatchConfig registers mat zone for each player without an existing source', () => {
  const registerCalls: Array<{ mat: string; playerId: number; tags: string[] }> = [];

  const config = {
    players: [createTestPlayer({ id: 1 }), createTestPlayer({ id: 2 })],
  } as unknown as ComputedMatchConfiguration;

  const initContext = {
    cardSourceController: {
      hasSource: () => false,
      registerZone: (mat: string, _cards: unknown[], playerId?: number, tags: string[] = []) => {
        registerCalls.push({ mat, playerId: playerId ?? -1, tags });
      },
    },
    loggerService: {
      debug: () => {},
    },
  } as unknown as InitializeExpansionContext;

  addMatToMatchConfig('island', config, initContext);

  assertEquals(registerCalls, [
    { mat: 'island', playerId: 1, tags: ['mat'] },
    { mat: 'island', playerId: 2, tags: ['mat'] },
  ]);
});

Deno.test('addMatToMatchConfig skips registration when source already exists for player/mat', () => {
  const registerCalls: Array<{ mat: string; playerId: number }> = [];

  const config = {
    players: [createTestPlayer({ id: 1 }), createTestPlayer({ id: 2 })],
  } as unknown as ComputedMatchConfiguration;

  const initContext = {
    cardSourceController: {
      hasSource: (_mat: string, playerId?: number) => playerId === 1,
      registerZone: (mat: string, _cards: unknown[], playerId?: number) => {
        registerCalls.push({ mat, playerId: playerId ?? -1 });
      },
    },
    loggerService: {
      debug: () => {},
    },
  } as unknown as InitializeExpansionContext;

  addMatToMatchConfig('island', config, initContext);

  assertEquals(registerCalls, [{ mat: 'island', playerId: 2 }]);
});
