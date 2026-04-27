import { assertEquals, assertNotEquals } from '@std/assert';
import { InMemoryMatchConfigurationSaveService } from '../in-memory-match-configuration-save-service.ts';
import type { MatchConfigurationSaveStore } from '../match-configuration-save-store.ts';
import type { LoggerService } from '../logger-service.ts';
import type { MatchConfiguration } from 'shared/types/index.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// Minimal logger stub that silences all output during tests.
const makeLoggerStub = (): LoggerService =>
  ({
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  }) as unknown as LoggerService;

/**
 * Builds a minimal valid MatchConfiguration fixture.
 *
 * All array fields are empty and the record fields are empty objects so the
 * value satisfies the interface without pulling in real game data.
 */
const makeConfiguration = (): MatchConfiguration =>
  ({
    players: [],
    expansions: [],
    bannedKingdoms: [],
    preselectedKingdoms: [],
    basicSupply: [],
    kingdomSupply: [],
    playerStartingHand: {},
    events: [],
    landmarks: [],
    projects: [],
    ways: [],
    traits: [],
    allies: [],
    prophecies: [],
    boons: [],
    hexes: [],
    states: [],
    artifacts: [],
  }) as MatchConfiguration;

// ---------------------------------------------------------------------------
// Conformance suite
// ---------------------------------------------------------------------------

/**
 * Runs the full MatchConfigurationSaveStore conformance suite against the
 * provided factory.
 *
 * The suite is parameterised so that any future backend (e.g. a
 * SupabaseMatchConfigurationSaveService test double) can be exercised with
 * the same assertions simply by passing a different factory.
 */
const runConformanceSuite = (name: string, factory: () => MatchConfigurationSaveStore) => {
  // ── checkSaveName ──────────────────────────────────────────────────────────

  Deno.test(`${name}: checkSaveName returns isValid=false for empty string`, () => {
    const store = factory();
    const result = store.checkSaveName('alice', '');
    assertEquals(result.isValid, false);
    assertEquals(result.exists, false);
  });

  Deno.test(`${name}: checkSaveName returns isValid=false for whitespace-only string`, () => {
    const store = factory();
    const result = store.checkSaveName('alice', '   ');
    assertEquals(result.isValid, false);
    assertEquals(result.exists, false);
  });

  Deno.test(`${name}: checkSaveName returns isValid=false for special-character-only string`, () => {
    const store = factory();
    // All characters stripped by normalization → empty normalized key.
    const result = store.checkSaveName('alice', '!!!');
    assertEquals(result.isValid, false);
    assertEquals(result.exists, false);
  });

  Deno.test(`${name}: checkSaveName returns isValid=true and exists=false for a valid new name`, () => {
    const store = factory();
    const result = store.checkSaveName('alice', 'my-save');
    assertEquals(result.isValid, true);
    assertEquals(result.exists, false);
    assertEquals(result.normalizedName, 'my-save');
  });

  Deno.test(`${name}: checkSaveName returns exists=true after a configuration is saved under that name`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'my-save', makeConfiguration());
    const result = store.checkSaveName('alice', 'my-save');
    assertEquals(result.isValid, true);
    assertEquals(result.exists, true);
  });

  Deno.test(`${name}: checkSaveName is user-scoped — same name for different users does not collide`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'shared', makeConfiguration());
    const result = store.checkSaveName('bob', 'shared');
    assertEquals(result.isValid, true);
    // Bob has never saved under this name, so it should not exist for him.
    assertEquals(result.exists, false);
  });

  Deno.test(`${name}: checkSaveName normalizes internal whitespace to hyphens`, () => {
    const store = factory();
    const result = store.checkSaveName('alice', 'my save name');
    assertEquals(result.isValid, true);
    assertEquals(result.normalizedName, 'my-save-name');
  });

  // ── listSavedConfigurations ────────────────────────────────────────────────

  Deno.test(`${name}: listSavedConfigurations returns empty array when user has no saves`, () => {
    const store = factory();
    assertEquals(store.listSavedConfigurations('alice'), []);
  });

  Deno.test(`${name}: listSavedConfigurations returns only the requesting user's saves`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'alice-save', makeConfiguration());
    store.saveConfiguration('bob', 'bob-save', makeConfiguration());
    const entries = store.listSavedConfigurations('alice');
    assertEquals(entries.length, 1);
    assertEquals(entries[0].name, 'alice-save');
  });

  Deno.test(`${name}: listSavedConfigurations returns entries sorted newest first`, async () => {
    const store = factory();
    store.saveConfiguration('alice', 'first', makeConfiguration());
    // Wait one millisecond so that the second save always has a strictly
    // greater savedAtMs than the first, regardless of clock resolution.
    await new Promise(resolve => setTimeout(resolve, 1));
    store.saveConfiguration('alice', 'second', makeConfiguration());
    const entries = store.listSavedConfigurations('alice');
    assertEquals(entries.length, 2);
    // Newest entry (second) must come before the oldest (first).
    assertEquals(entries[0].name, 'second');
    assertEquals(entries[1].name, 'first');
  });

  Deno.test(`${name}: listSavedConfigurations treats username comparison as case-insensitive`, () => {
    const store = factory();
    store.saveConfiguration('Alice', 'config', makeConfiguration());
    const entries = store.listSavedConfigurations('alice');
    assertEquals(entries.length, 1);
  });

  // ── saveConfiguration ──────────────────────────────────────────────────────

  Deno.test(`${name}: saveConfiguration returns ok=true and saves under normalized key`, () => {
    const store = factory();
    const result = store.saveConfiguration('alice', 'My Save', makeConfiguration());
    assertEquals(result.ok, true);
    // The display name is the trimmed raw input.
    assertEquals(result.name, 'My Save');
  });

  Deno.test(`${name}: saveConfiguration returns ok=false for an invalid name`, () => {
    const store = factory();
    const result = store.saveConfiguration('alice', '!!!', makeConfiguration());
    assertEquals(result.ok, false);
  });

  Deno.test(`${name}: saveConfiguration overwrites an existing save with the same key`, () => {
    const store = factory();
    const configA = makeConfiguration();
    const configB = { ...makeConfiguration(), players: [] };
    store.saveConfiguration('alice', 'my-save', configA);
    const result = store.saveConfiguration('alice', 'my-save', configB);
    assertEquals(result.ok, true);
    // Only one entry should exist after the overwrite.
    assertEquals(store.listSavedConfigurations('alice').length, 1);
  });

  Deno.test(`${name}: saveConfiguration stores a deep clone of the configuration`, () => {
    const store = factory();
    const config = makeConfiguration();
    store.saveConfiguration('alice', 'my-save', config);
    // Mutating the original after saving must not affect the stored copy.
    (config as unknown as Record<string, unknown>)['_mutated'] = true;
    const loaded = store.loadConfiguration('alice', 'my-save');
    assertEquals(loaded.ok, true);
    if (loaded.ok) {
      assertEquals((loaded.configuration as unknown as Record<string, unknown>)['_mutated'], undefined);
    }
  });

  // ── loadConfiguration ──────────────────────────────────────────────────────

  Deno.test(`${name}: loadConfiguration returns ok=false for an invalid key`, () => {
    const store = factory();
    const result = store.loadConfiguration('alice', '!!!');
    assertEquals(result.ok, false);
  });

  Deno.test(`${name}: loadConfiguration returns ok=false when save does not exist`, () => {
    const store = factory();
    const result = store.loadConfiguration('alice', 'nonexistent');
    assertEquals(result.ok, false);
  });

  Deno.test(`${name}: loadConfiguration returns ok=true with configuration for an existing save`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'my-save', makeConfiguration());
    const result = store.loadConfiguration('alice', 'my-save');
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(typeof result.configuration, 'object');
    }
  });

  Deno.test(`${name}: loadConfiguration returns a deep clone — mutations do not affect the store`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'my-save', makeConfiguration());
    const r1 = store.loadConfiguration('alice', 'my-save');
    if (!r1.ok) throw new Error('Expected ok');
    // Mutate the returned configuration.
    (r1.configuration as unknown as Record<string, unknown>)['_mutated'] = true;
    // A second load must not see the mutation.
    const r2 = store.loadConfiguration('alice', 'my-save');
    if (!r2.ok) throw new Error('Expected ok');
    assertEquals((r2.configuration as unknown as Record<string, unknown>)['_mutated'], undefined);
  });

  Deno.test(`${name}: loadConfiguration key lookup is case-insensitive for username`, () => {
    const store = factory();
    store.saveConfiguration('Alice', 'my-save', makeConfiguration());
    const result = store.loadConfiguration('alice', 'my-save');
    assertEquals(result.ok, true);
  });

  // ── getSavedConfiguration ──────────────────────────────────────────────────

  Deno.test(`${name}: getSavedConfiguration returns ok=false for an invalid key`, () => {
    const store = factory();
    const result = store.getSavedConfiguration('alice', '!!!');
    assertEquals(result.ok, false);
  });

  Deno.test(`${name}: getSavedConfiguration returns ok=false when save does not exist`, () => {
    const store = factory();
    const result = store.getSavedConfiguration('alice', 'nonexistent');
    assertEquals(result.ok, false);
  });

  Deno.test(`${name}: getSavedConfiguration returns entry metadata and configuration for an existing save`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'My Save', makeConfiguration());
    const result = store.getSavedConfiguration('alice', 'My-Save');
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.entry.name, 'My Save');
      assertEquals(result.entry.key, 'My-Save');
      assertEquals(typeof result.entry.savedAtMs, 'number');
      assertEquals(typeof result.configuration, 'object');
    }
  });

  Deno.test(`${name}: getSavedConfiguration returns a deep clone of the configuration`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'my-save', makeConfiguration());
    const r1 = store.getSavedConfiguration('alice', 'my-save');
    if (!r1.ok) throw new Error('Expected ok');
    (r1.configuration as unknown as Record<string, unknown>)['_mutated'] = true;
    const r2 = store.getSavedConfiguration('alice', 'my-save');
    if (!r2.ok) throw new Error('Expected ok');
    assertEquals((r2.configuration as unknown as Record<string, unknown>)['_mutated'], undefined);
  });

  // ── updateConfiguration ────────────────────────────────────────────────────

  Deno.test(`${name}: updateConfiguration returns ok=false for an invalid key`, () => {
    const store = factory();
    const result = store.updateConfiguration('alice', '!!!', makeConfiguration());
    assertEquals(result.ok, false);
  });

  Deno.test(`${name}: updateConfiguration returns ok=false when save does not exist`, () => {
    const store = factory();
    const result = store.updateConfiguration('alice', 'nonexistent', makeConfiguration());
    assertEquals(result.ok, false);
  });

  Deno.test(`${name}: updateConfiguration replaces the stored configuration`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'my-save', makeConfiguration());
    const updated = { ...makeConfiguration(), players: [] };
    const result = store.updateConfiguration('alice', 'my-save', updated);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.key, 'my-save');
    }
  });

  Deno.test(`${name}: updateConfiguration preserves the existing display name when requestedName is omitted`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'Display Name', makeConfiguration());
    const result = store.updateConfiguration('alice', 'Display-Name', makeConfiguration());
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.name, 'Display Name');
    }
  });

  Deno.test(`${name}: updateConfiguration uses requestedName when provided`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'Old Name', makeConfiguration());
    const result = store.updateConfiguration('alice', 'Old-Name', makeConfiguration(), 'New Name');
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.name, 'New Name');
    }
  });

  Deno.test(`${name}: updateConfiguration stores a deep clone of the new configuration`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'my-save', makeConfiguration());
    const config = makeConfiguration();
    store.updateConfiguration('alice', 'my-save', config);
    // Mutate the config after the update call.
    (config as unknown as Record<string, unknown>)['_mutated'] = true;
    const loaded = store.loadConfiguration('alice', 'my-save');
    assertEquals(loaded.ok, true);
    if (loaded.ok) {
      assertEquals((loaded.configuration as unknown as Record<string, unknown>)['_mutated'], undefined);
    }
  });

  // ── deleteConfiguration ────────────────────────────────────────────────────

  Deno.test(`${name}: deleteConfiguration returns ok=false for an invalid key`, () => {
    const store = factory();
    const result = store.deleteConfiguration('alice', '!!!');
    assertEquals(result.ok, false);
  });

  Deno.test(`${name}: deleteConfiguration returns ok=false when save does not exist`, () => {
    const store = factory();
    const result = store.deleteConfiguration('alice', 'nonexistent');
    assertEquals(result.ok, false);
  });

  Deno.test(`${name}: deleteConfiguration removes the save and returns ok=true`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'to-delete', makeConfiguration());
    const result = store.deleteConfiguration('alice', 'to-delete');
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.key, 'to-delete');
    }
    assertEquals(store.listSavedConfigurations('alice').length, 0);
  });

  Deno.test(`${name}: deleteConfiguration is user-scoped — does not remove another user's save`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'shared-name', makeConfiguration());
    store.saveConfiguration('bob', 'shared-name', makeConfiguration());
    store.deleteConfiguration('alice', 'shared-name');
    // Bob's save must still be present.
    assertEquals(store.listSavedConfigurations('bob').length, 1);
  });

  // ── deleteAllConfigurations ────────────────────────────────────────────────

  Deno.test(`${name}: deleteAllConfigurations with username removes only that user's saves`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'a1', makeConfiguration());
    store.saveConfiguration('alice', 'a2', makeConfiguration());
    store.saveConfiguration('bob', 'b1', makeConfiguration());
    const result = store.deleteAllConfigurations('alice');
    assertEquals(result.ok, true);
    assertEquals(result.removed, 2);
    assertEquals(store.listSavedConfigurations('alice').length, 0);
    // Bob's save must be unaffected.
    assertEquals(store.listSavedConfigurations('bob').length, 1);
  });

  Deno.test(`${name}: deleteAllConfigurations without username removes all users' saves`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'a1', makeConfiguration());
    store.saveConfiguration('bob', 'b1', makeConfiguration());
    const result = store.deleteAllConfigurations();
    assertEquals(result.ok, true);
    assertEquals(result.removed, 2);
    assertEquals(store.listSavedConfigurations('alice').length, 0);
    assertEquals(store.listSavedConfigurations('bob').length, 0);
  });

  Deno.test(`${name}: deleteAllConfigurations returns removed=0 when no saves exist`, () => {
    const store = factory();
    const result = store.deleteAllConfigurations('alice');
    assertEquals(result.ok, true);
    assertEquals(result.removed, 0);
  });

  Deno.test(`${name}: deleteAllConfigurations with username is case-insensitive`, () => {
    const store = factory();
    store.saveConfiguration('Alice', 'save', makeConfiguration());
    const result = store.deleteAllConfigurations('alice');
    assertEquals(result.ok, true);
    assertEquals(result.removed, 1);
  });

  // ── listAllSavedConfigurations ─────────────────────────────────────────────

  Deno.test(`${name}: listAllSavedConfigurations returns saves across all users`, () => {
    const store = factory();
    store.saveConfiguration('alice', 'a-save', makeConfiguration());
    store.saveConfiguration('bob', 'b-save', makeConfiguration());
    const all = store.listAllSavedConfigurations();
    assertEquals(all.length, 2);
  });

  Deno.test(`${name}: listAllSavedConfigurations returns empty array when no saves exist`, () => {
    const store = factory();
    assertEquals(store.listAllSavedConfigurations().length, 0);
  });

  // ── cross-cutting / isolation ──────────────────────────────────────────────

  Deno.test(`${name}: each factory call produces an independent store`, () => {
    const storeA = factory();
    const storeB = factory();
    storeA.saveConfiguration('alice', 'my-save', makeConfiguration());
    // storeB is a fresh instance — it must not see storeA's data.
    assertEquals(storeB.listSavedConfigurations('alice').length, 0);
  });

  Deno.test(`${name}: saving and loading round-trips the configuration`, () => {
    const store = factory();
    const config = makeConfiguration();
    store.saveConfiguration('alice', 'roundtrip', config);
    const result = store.loadConfiguration('alice', 'roundtrip');
    assertEquals(result.ok, true);
    if (result.ok) {
      // Structural equality (deep clone, not reference equality).
      assertEquals(result.configuration, config);
      assertNotEquals(result.configuration, undefined);
    }
  });
};

// ---------------------------------------------------------------------------
// Register suite for InMemoryMatchConfigurationSaveService
// ---------------------------------------------------------------------------
runConformanceSuite(
  'InMemoryMatchConfigurationSaveService',
  () => new InMemoryMatchConfigurationSaveService(makeLoggerStub()),
);
