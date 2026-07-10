import { assertEquals } from '@std/assert';
import { SupabaseMatchConfigurationSaveService } from '../supabase-match-configuration-save-service.ts';
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
 * value satisfies the interface without pulling in real game data. Mirrors
 * the fixture in in-memory-match-configuration-save-service.spec.ts.
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

/**
 * Builds a fresh SupabaseMatchConfigurationSaveService without calling
 * `open()` — the Supabase client stays undefined, so every DB write in the
 * service (`this.client?.from(...)`) is a synchronous no-op. This leaves
 * only the in-memory write-through cache under test, which is exactly the
 * layer where the case-sensitive cacheKey bug (9.3) lived.
 */
const makeService = (): SupabaseMatchConfigurationSaveService => new SupabaseMatchConfigurationSaveService(makeLoggerStub());

// ---------------------------------------------------------------------------
// Regression coverage for the case-sensitive cacheKey bug (9.3)
//
// Before the fix, `cacheKey()` expected a pre-lowercased username, but
// `checkSaveName` / `loadConfiguration` / `getSavedConfiguration` passed the
// raw (possibly mixed-case) username while `saveConfiguration` /
// `updateConfiguration` lowercased it first. A user who saved under a
// mixed-case display username (e.g. the auth system's stored 'Alice') could
// therefore save successfully but never load, check, or fetch the save back.
// ---------------------------------------------------------------------------

Deno.test('SupabaseMatchConfigurationSaveService: save as mixed-case username, checkSaveName finds it under both cases', () => {
  const service = makeService();
  service.saveConfiguration('Alice', 'my-save', makeConfiguration());

  const mixedCase = service.checkSaveName('Alice', 'my-save');
  assertEquals(mixedCase.exists, true);

  const lowerCase = service.checkSaveName('alice', 'my-save');
  assertEquals(lowerCase.exists, true);
});

Deno.test('SupabaseMatchConfigurationSaveService: save as mixed-case username, loadConfiguration round-trips for both cases', () => {
  const service = makeService();
  const config = makeConfiguration();
  service.saveConfiguration('Alice', 'my-save', config);

  const asMixedCase = service.loadConfiguration('Alice', 'my-save');
  assertEquals(asMixedCase.ok, true);

  const asLowerCase = service.loadConfiguration('alice', 'my-save');
  assertEquals(asLowerCase.ok, true);
  if (asLowerCase.ok) {
    assertEquals(asLowerCase.configuration, config);
  }
});

Deno.test('SupabaseMatchConfigurationSaveService: save as lowercase username, loadConfiguration round-trips for uppercase lookup', () => {
  // Guards the reverse direction too — case-insensitivity must hold
  // regardless of which case was used at save time.
  const service = makeService();
  service.saveConfiguration('alice', 'my-save', makeConfiguration());

  const asUpperCase = service.loadConfiguration('ALICE', 'my-save');
  assertEquals(asUpperCase.ok, true);
});

Deno.test('SupabaseMatchConfigurationSaveService: getSavedConfiguration round-trips regardless of username casing', () => {
  const service = makeService();
  // Save-name normalization only affects whitespace/special characters — it
  // does not lowercase the save key itself, so the key used here must match
  // the normalized form of 'my save' ('my-save') exactly. Only the username
  // side of the lookup is under test.
  service.saveConfiguration('Alice', 'my save', makeConfiguration());

  const result = service.getSavedConfiguration('alice', 'my-save');
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.entry.key, 'my-save');
    assertEquals(result.entry.name, 'my save');
  }
});

Deno.test('SupabaseMatchConfigurationSaveService: listSavedConfigurations is case-insensitive for username', () => {
  const service = makeService();
  service.saveConfiguration('Alice', 'my-save', makeConfiguration());

  const entries = service.listSavedConfigurations('alice');
  assertEquals(entries.length, 1);
});

Deno.test('SupabaseMatchConfigurationSaveService: updateConfiguration finds an existing save regardless of username casing', () => {
  const service = makeService();
  service.saveConfiguration('Alice', 'my-save', makeConfiguration());

  const updated = { ...makeConfiguration(), players: [] };
  const result = service.updateConfiguration('alice', 'my-save', updated);
  assertEquals(result.ok, true);

  const reloaded = service.loadConfiguration('ALICE', 'my-save');
  assertEquals(reloaded.ok, true);
});

Deno.test('SupabaseMatchConfigurationSaveService: deleteConfiguration removes a save saved under a different case', () => {
  const service = makeService();
  service.saveConfiguration('Alice', 'my-save', makeConfiguration());

  const result = service.deleteConfiguration('alice', 'my-save');
  assertEquals(result.ok, true);
  assertEquals(service.listSavedConfigurations('Alice').length, 0);
});
