import { assertEquals } from '@std/assert';
import { asClass, asValue } from 'awilix';
import { ExpansionCompatibilityService } from '../expansion-compatibility-service.ts';
import { createTestContainer } from '../../testing/create-test-container.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';
import { createTestMatchConfiguration } from '../../testing/create-test-match-configuration.ts';
import type { LoggerService } from '../logger-service.ts';

Deno.test('ExpansionCompatibilityService removes mutually-exclusive expansions from next config', async () => {
  const { entries, loggerService } = createTestLogger({ scope: 'test', testCase: 'mutual-exclusion' });
  const container = createTestContainer<{
    expansionCompatibilityService: ExpansionCompatibilityService;
    loggerService: LoggerService;
  }>();

  container.register({
    loggerService: asValue(loggerService),
    expansionCompatibilityService: asClass(ExpansionCompatibilityService).singleton(),
  });

  const expansionCompatibilityService = container.resolve('expansionCompatibilityService');
  const currentConfig = createTestMatchConfiguration({
    expansions: [{ name: 'base-v1', order: 1, title: 'Base (First Edition)' }],
  });
  const nextConfig = createTestMatchConfiguration({
    expansions: [
      { name: 'base-v1', order: 1, title: 'Base (First Edition)' },
      { name: 'base-v2', order: 2, title: 'Base' },
    ],
  });

  await expansionCompatibilityService.applyMutualExclusions(currentConfig, nextConfig);

  assertEquals(nextConfig.expansions.map(expansion => expansion.name), ['base-v2']);
  assertEquals(entries.some(entry => entry.level === 'info' && String(entry.args).includes('removing expansion')), true);
});

Deno.test('ExpansionCompatibilityService warns when expansion config module is missing', async () => {
  const { entries, loggerService } = createTestLogger({ scope: 'test', testCase: 'missing-module' });
  const container = createTestContainer<{
    expansionCompatibilityService: ExpansionCompatibilityService;
    loggerService: LoggerService;
  }>();

  container.register({
    loggerService: asValue(loggerService),
    expansionCompatibilityService: asClass(ExpansionCompatibilityService).singleton(),
  });

  const expansionCompatibilityService = container.resolve('expansionCompatibilityService');
  const currentConfig = createTestMatchConfiguration({ expansions: [] });
  const nextConfig = createTestMatchConfiguration({
    expansions: [{ name: 'not-a-real-expansion', order: 1, title: 'Missing' }],
  });

  await expansionCompatibilityService.applyMutualExclusions(currentConfig, nextConfig);

  assertEquals(nextConfig.expansions.map(expansion => expansion.name), ['not-a-real-expansion']);
  assertEquals(entries.some(entry => entry.level === 'warn' && String(entry.args).includes('could not find config module')), true);
});

Deno.test('ExpansionCompatibilityService keeps expansions when no mutual exclusions exist', async () => {
  const { entries, loggerService } = createTestLogger({ scope: 'test', testCase: 'no-mutuals' });
  const container = createTestContainer<{
    expansionCompatibilityService: ExpansionCompatibilityService;
    loggerService: LoggerService;
  }>();

  container.register({
    loggerService: asValue(loggerService),
    expansionCompatibilityService: asClass(ExpansionCompatibilityService).singleton(),
  });

  const expansionCompatibilityService = container.resolve('expansionCompatibilityService');
  const currentConfig = createTestMatchConfiguration({ expansions: [] });
  const nextConfig = createTestMatchConfiguration({
    expansions: [{ name: 'allies', order: 1, title: 'Allies' }],
  });

  await expansionCompatibilityService.applyMutualExclusions(currentConfig, nextConfig);

  assertEquals(nextConfig.expansions.map(expansion => expansion.name), ['allies']);
  assertEquals(
    entries.some(entry => entry.level === 'debug' && String(entry.args).includes('contains no mutually exclusive expansions')),
    true,
  );
});
