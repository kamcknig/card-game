import { assertEquals } from '@std/assert';
import type { CardNoId, ComputedMatchConfiguration, Supply } from 'shared/types/index.ts';
import type { ExpansionConfiguratorContext } from '@server-types/index.ts';
import { createTestPlayer } from '../../../testing/create-test-player.ts';
import { configureReserve } from '../configure-reserve.ts';

// Builds a minimal Supply entry matching the shape configureReserve inspects.
const createSupply = (cardKey: string, types: string[], pileName?: string): Supply => ({
  name: pileName ?? cardKey,
  cards: [
    {
      cardKey,
      type: types,
    } as unknown as CardNoId,
  ],
});

// Builds an ExpansionConfiguratorContext stub that captures register/log calls for assertions.
const createContext = (kingdomSupply: Supply[]) => {
  const registerCalls: Array<{ mat: string; playerId?: number; tags: string[] }> = [];
  const infoLogs: string[] = [];

  const config = {
    players: [createTestPlayer({ id: 1 }), createTestPlayer({ id: 2 })],
    kingdomSupply,
  } as unknown as ComputedMatchConfiguration;

  const args = {
    config,
    cardSourceController: {
      hasSource: () => false,
      registerZone: (mat: string, _cards: unknown[], playerId?: number, tags: string[] = []) => {
        registerCalls.push({ mat, playerId, tags });
      },
    },
    loggerService: {
      debug: () => {},
      info: (...parts: unknown[]) => {
        infoLogs.push(parts.join(' '));
      },
    },
  } as unknown as ExpansionConfiguratorContext;

  return { args, registerCalls, infoLogs };
};

Deno.test('configureReserve registers tavern mat when a RESERVE card is in the kingdom', () => {
  const { args, registerCalls } = createContext([createSupply('guide', ['ACTION', 'RESERVE'])]);

  configureReserve(args);

  assertEquals(registerCalls, [
    { mat: 'tavern', playerId: 1, tags: ['mat'] },
    { mat: 'tavern', playerId: 2, tags: ['mat'] },
  ]);
});

Deno.test('configureReserve registers tavern mat when miser is in the kingdom (non-RESERVE tavern user)', () => {
  const { args, registerCalls } = createContext([createSupply('miser', ['ACTION'])]);

  configureReserve(args);

  assertEquals(registerCalls, [
    { mat: 'tavern', playerId: 1, tags: ['mat'] },
    { mat: 'tavern', playerId: 2, tags: ['mat'] },
  ]);
});

Deno.test('configureReserve skips tavern mat when neither RESERVE cards nor non-RESERVE tavern users are in the kingdom', () => {
  const { args, registerCalls } = createContext([
    createSupply('village', ['ACTION']),
    createSupply('smithy', ['ACTION']),
  ]);

  configureReserve(args);

  assertEquals(registerCalls, []);
});
