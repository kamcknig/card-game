import { assertEquals, assertNotStrictEquals, assertStrictEquals } from '@std/assert';
import type { ComputedMatchConfiguration, Match } from 'shared/types/index.ts';
import type { CardSourceController } from '../../core/card-source-controller.ts';
import type { CardInstanceFactoryService } from '../../core/card-instance-factory-service.ts';
import { RngService } from '../../core/rng-service.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { createTestMatchConfiguration } from '../../testing/create-test-match-configuration.ts';
import {
  applyMidGameFaqGuards,
  isTemporarySetupProxySupply,
  rerunExpansionConfiguratorsMidGame,
  stripTemporarySetupProxyKingdomPiles,
} from '../rerun-expansion-configurators-mid-game.ts';

// Builds a no-op ExpansionRegistrationFacade for tests that don't assert on registration calls.
const createNoopExpansionRegistration = () => ({
  registerCardEffect: () => {},
  registerBoonEffect: () => {},
  registerHexEffect: () => {},
  registerStateEffect: () => {},
  registerArtifactEffect: () => {},
  registerProjectEffect: () => {},
  registerTokenDefinition: () => {},
  registerTokenCardPlayedHandler: () => {},
});

// Wraps a bare MatchConfiguration fixture as a ComputedMatchConfiguration (the extra fields are
// unread by the configurators exercised in this file).
const toComputedConfig = (
  config: ReturnType<typeof createTestMatchConfiguration>,
): ComputedMatchConfiguration => ({
  ...config,
  startingHand: {},
  mats: {},
});

Deno.test('stripTemporarySetupProxyKingdomPiles removes only fully-proxy-tagged piles', () => {
  const { loggerService } = createTestLogger();
  const proxyCard = createTestCard({
    cardKey: 'mouse-proxy',
    metadata: { base: { isSetupProxyKingdomPile: true } },
  });
  const realCard = createTestCard({ cardKey: 'village' });

  const config = toComputedConfig(
    createTestMatchConfiguration({
      kingdomSupply: [
        { name: 'mouse-proxy', cards: [proxyCard] },
        { name: 'village', cards: [realCard, realCard] },
      ],
    }),
  );

  stripTemporarySetupProxyKingdomPiles(config, loggerService);

  assertEquals(config.kingdomSupply.map(supply => supply.name), ['village']);
});

Deno.test('isTemporarySetupProxySupply is false for an empty pile and for a pile with any non-proxy card', () => {
  assertEquals(isTemporarySetupProxySupply({ cards: [] }), false);

  const proxyCard = createTestCard({ metadata: { base: { isSetupProxyKingdomPile: true } } });
  const realCard = createTestCard({ metadata: {} });
  assertEquals(isTemporarySetupProxySupply({ cards: [proxyCard, realCard] }), false);
  assertEquals(isTemporarySetupProxySupply({ cards: [proxyCard, proxyCard] }), true);
});

Deno.test('applyMidGameFaqGuards restores playerStartingHand and keeps only pre-existing or potion basicSupply entries', () => {
  const { loggerService, entries } = createTestLogger();

  const startingHandSnapshot = { copper: 7, estate: 3 };
  const potionCard = createTestCard({ cardKey: 'potion' });
  const copperCard = createTestCard({ cardKey: 'copper' });
  const platinumCard = createTestCard({ cardKey: 'platinum' });

  const config = toComputedConfig(
    createTestMatchConfiguration({
      // Simulates a configurator having mutated startingHand mid-rerun (must be discarded).
      playerStartingHand: { copper: 99, shelter: 1 },
      basicSupply: [
        { name: 'copper', cards: [copperCard] }, // pre-existing — kept
        { name: 'potion', cards: new Array(16).fill(potionCard) }, // newly added potion — kept
        { name: 'platinum', cards: [platinumCard] }, // newly added, not potion — discarded
      ],
    }),
  );

  applyMidGameFaqGuards(
    config,
    { startingHandSnapshot, basicSupplyNamesBefore: new Set(['copper']) },
    loggerService,
  );

  assertEquals(config.playerStartingHand, startingHandSnapshot);
  assertEquals(
    config.basicSupply.map(supply => supply.name),
    ['copper', 'potion'],
  );
  // The discard must be logged so a shortfall is visible in match logs.
  assertEquals(
    entries.some(entry => entry.level === 'warn' && entry.args.some(arg => String(arg).includes('platinum'))),
    true,
  );
});

Deno.test('rerunExpansionConfiguratorsMidGame lets the real alchemy configurator add a Potion pile for a mid-game potion-cost card', async () => {
  const { loggerService } = createTestLogger();

  const potionCard = createTestCard({ cardKey: 'potion', expansionName: 'alchemy' });
  const alchemistCard = createTestCard({
    cardKey: 'alchemist',
    expansionName: 'alchemy',
    cost: { treasure: 3, potion: 1 },
  });

  const config = toComputedConfig(
    createTestMatchConfiguration({
      expansions: [{ name: 'alchemy', title: 'Alchemy', order: 1 }],
      kingdomSupply: [{ name: 'alchemist', cards: [alchemistCard, alchemistCard] }],
      basicSupply: [],
    }),
  );

  const match = { config } as unknown as Match;

  await rerunExpansionConfiguratorsMidGame({
    match,
    expansionCatalog: {},
    rawCardLibrary: { potion: potionCard, alchemist: alchemistCard },
    cardSourceController: {} as CardSourceController,
    cardInstanceFactoryService: {} as CardInstanceFactoryService,
    rngService: new RngService(),
    loggerService,
    expansionRegistration: createNoopExpansionRegistration(),
  });

  assertEquals(
    config.basicSupply.map(supply => supply.name),
    ['potion'],
  );
  assertEquals(config.basicSupply[0].cards.length, 16);
});

Deno.test('rerunExpansionConfiguratorsMidGame tolerates an expansion with no configurator file', async () => {
  const { loggerService } = createTestLogger();

  const config = toComputedConfig(
    createTestMatchConfiguration({
      // hinterlands has no configurator-hinterlands.ts — exercises the ERR_MODULE_NOT_FOUND branch.
      expansions: [{ name: 'hinterlands', title: 'Hinterlands', order: 1 }],
    }),
  );
  const match = { config } as unknown as Match;

  // Must resolve without throwing despite the missing configurator module.
  await rerunExpansionConfiguratorsMidGame({
    match,
    expansionCatalog: {},
    rawCardLibrary: {},
    cardSourceController: {} as CardSourceController,
    cardInstanceFactoryService: {} as CardInstanceFactoryService,
    rngService: new RngService(),
    loggerService,
    expansionRegistration: createNoopExpansionRegistration(),
  });

  // Config is otherwise untouched — no configurator ran.
  assertEquals(config.kingdomSupply, []);
});

Deno.test('rerunExpansionConfiguratorsMidGame passes expansionRegistration through unmodified to the real base-v2 configurator', async () => {
  const { loggerService } = createTestLogger();
  const registeredTokenIds: string[] = [];

  const config = toComputedConfig(
    createTestMatchConfiguration({
      expansions: [{ name: 'base-v2', title: 'Base', order: 1 }],
    }),
  );
  const match = { config } as unknown as Match;

  await rerunExpansionConfiguratorsMidGame({
    match,
    expansionCatalog: {},
    rawCardLibrary: {},
    cardSourceController: {} as CardSourceController,
    cardInstanceFactoryService: {} as CardInstanceFactoryService,
    rngService: new RngService(),
    loggerService,
    expansionRegistration: {
      ...createNoopExpansionRegistration(),
      registerTokenDefinition: definition => registeredTokenIds.push(definition.id),
    },
  });

  // base-v2's configurator registers token definitions on every run (idempotent overwrite) —
  // this is the "expansionRegistration passes through unmodified" contract in action.
  assertEquals(registeredTokenIds.length > 0, true);
  // No config mutation is expected from base-v2's configurator.
  assertEquals(config.kingdomSupply, []);
});

// Sanity: helper exports are stable references usable independently of the orchestration function.
Deno.test('helper exports are independently callable', () => {
  assertStrictEquals(typeof stripTemporarySetupProxyKingdomPiles, 'function');
  assertStrictEquals(typeof applyMidGameFaqGuards, 'function');
  assertStrictEquals(typeof isTemporarySetupProxySupply, 'function');
  assertNotStrictEquals(rerunExpansionConfiguratorsMidGame, undefined);
});
