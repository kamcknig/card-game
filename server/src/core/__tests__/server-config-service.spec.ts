import { assertEquals, assertThrows } from '@std/assert';
import { ServerConfigService } from '../server-config-service.ts';

const TEST_ENV_KEYS = [
  'PORT',
  'LOG_TO_FILE',
  'LOG_FILE_MAX_BYTES',
  'MATCH_STATE_EXPORT_ENABLED',
  'MATCH_STATE_MERGE_ENABLED',
  'END_MATCH_ON_NO_HUMANS',
  'MATCH_STATE_PATH',
  'TOOLTIP_DEFAULT_CLOSE_DELAY_MS',
  'AUTH_ALLOWED_ORIGINS',
  'AUTH_RATE_LIMIT_MAX_ATTEMPTS',
  'AUTH_RATE_LIMIT_WINDOW_MS',
  'AUTH_MAX_BODY_BYTES',
] as const;

// Runs a test block with automatic save/restore of env vars used by ServerConfigService.
const withIsolatedEnv = (run: () => void) => {
  const beforeValues = new Map<string, string | undefined>(
    TEST_ENV_KEYS.map(key => [key, Deno.env.get(key)]),
  );

  try {
    for (const key of TEST_ENV_KEYS) {
      Deno.env.delete(key);
    }
    run();
  } finally {
    for (const key of TEST_ENV_KEYS) {
      const value = beforeValues.get(key);
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
};

Deno.test('ServerConfigService provides default values when env vars are unset', () => {
  withIsolatedEnv(() => {
    const serverConfigService = new ServerConfigService();

    assertEquals(serverConfigService.getPort(), 3001);
    assertEquals(serverConfigService.isFileLoggingEnabled(), false);
    assertEquals(serverConfigService.getLogFileMaxBytes(), 5 * 1024 * 1024);
    assertEquals(serverConfigService.isMatchStateExportEnabled(), false);
    assertEquals(serverConfigService.isMatchStateMergeEnabled(), false);
    assertEquals(serverConfigService.shouldEndMatchOnNoHumans(), true);
    assertEquals(serverConfigService.getMatchStatePath(), undefined);
    assertEquals(serverConfigService.getTooltipDefaultCloseDelayMs(), undefined);
  });
});

Deno.test('ServerConfigService parses valid env values', () => {
  withIsolatedEnv(() => {
    Deno.env.set('PORT', '4000');
    Deno.env.set('LOG_TO_FILE', 'true');
    Deno.env.set('LOG_FILE_MAX_BYTES', '1024');
    Deno.env.set('MATCH_STATE_EXPORT_ENABLED', 'true');
    Deno.env.set('MATCH_STATE_MERGE_ENABLED', 'false');
    Deno.env.set('END_MATCH_ON_NO_HUMANS', 'false');
    Deno.env.set('MATCH_STATE_PATH', './tmp/state.json');
    Deno.env.set('TOOLTIP_DEFAULT_CLOSE_DELAY_MS', '350');

    const serverConfigService = new ServerConfigService();

    assertEquals(serverConfigService.getPort(), 4000);
    assertEquals(serverConfigService.isFileLoggingEnabled(), true);
    assertEquals(serverConfigService.getLogFileMaxBytes(), 1024);
    assertEquals(serverConfigService.isMatchStateExportEnabled(), true);
    assertEquals(serverConfigService.isMatchStateMergeEnabled(), false);
    assertEquals(serverConfigService.shouldEndMatchOnNoHumans(), false);
    assertEquals(serverConfigService.getMatchStatePath(), './tmp/state.json');
    assertEquals(serverConfigService.getTooltipDefaultCloseDelayMs(), 350);
  });
});

Deno.test('ServerConfigService throws on invalid env values', () => {
  withIsolatedEnv(() => {
    Deno.env.set('PORT', '70000');
    const serverConfigService = new ServerConfigService();
    assertThrows(() => serverConfigService.getPort(), Error, 'PORT must be an integer');
  });

  withIsolatedEnv(() => {
    Deno.env.set('LOG_TO_FILE', 'yes');
    const serverConfigService = new ServerConfigService();
    assertThrows(() => serverConfigService.isFileLoggingEnabled(), Error, "LOG_TO_FILE must be 'true' or 'false'");
  });

  withIsolatedEnv(() => {
    Deno.env.set('LOG_FILE_MAX_BYTES', '0');
    const serverConfigService = new ServerConfigService();
    assertThrows(() => serverConfigService.getLogFileMaxBytes(), Error, 'LOG_FILE_MAX_BYTES must be a positive integer');
  });

  withIsolatedEnv(() => {
    Deno.env.set('TOOLTIP_DEFAULT_CLOSE_DELAY_MS', '-1');
    const serverConfigService = new ServerConfigService();
    assertThrows(
      () => serverConfigService.getTooltipDefaultCloseDelayMs(),
      Error,
      'TOOLTIP_DEFAULT_CLOSE_DELAY_MS must be a non-negative integer',
    );
  });
});

Deno.test('ServerConfigService.validate checks all required config fields', () => {
  withIsolatedEnv(() => {
    Deno.env.set('MATCH_STATE_MERGE_ENABLED', 'invalid');
    const serverConfigService = new ServerConfigService();

    assertThrows(
      () => serverConfigService.validate(),
      Error,
      "MATCH_STATE_MERGE_ENABLED must be 'true' or 'false'",
    );
  });
});


