/**
 * Bootstrap/maintenance CLI — creates a registration code directly in the
 * Deno KV auth store so a new user can sign up without an existing session.
 *
 * Usage:
 *   deno task auth:create-reg-code [--expires-in <duration>] [--max-uses N]
 *                                   [--created-by <user>] [--kv <path>]
 *
 * Duration strings accepted for --expires-in: `<n>s`, `<n>m`, `<n>h`, `<n>d`.
 * Omit the flag for a code that never expires. --max-uses defaults to 1.
 *
 * On success the generated code is printed to stdout. Treat it as a secret;
 * anyone presenting it to POST /auth/register can create an account.
 *
 * Defined in: server/scripts/auth-create-reg-code.ts
 * Exposed as: `deno task auth:create-reg-code` (see server/deno.json).
 */

import { DenoKvRegistrationCodeStore } from '../src/core/auth/deno-kv-registration-code-store.ts';
import type { LoggerService } from '../src/core/logger-service.ts';

// Parses `--flag value` pairs. Same minimal flavor as auth-create-user.ts.
const parseArgs = (args: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const name = arg.slice(2);
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    out[name] = value;
    i++;
  }
  return out;
};

// Converts a duration string like `24h` or `30m` into milliseconds.
// Returns null when the input is missing; throws on an unrecognized format.
const parseDuration = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!m) {
    throw new Error(`Invalid duration '${raw}' (expected e.g. 30m, 24h, 7d)`);
  }
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case 'ms':
      return n;
    case 's':
      return n * 1_000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
  }
  throw new Error(`Invalid duration unit '${unit}'`);
};

// Minimal console-backed logger — no DI dependency.
const consoleLogger: LoggerService = {
  log: (...a: unknown[]) => console.log('[auth:create-reg-code]', ...a),
  info: (...a: unknown[]) => console.log('[auth:create-reg-code]', ...a),
  warn: (...a: unknown[]) => console.warn('[auth:create-reg-code]', ...a),
  debug: () => {},
  error: (...a: unknown[]) => console.error('[auth:create-reg-code]', ...a),
} as unknown as LoggerService;

const main = async (): Promise<void> => {
  let argMap: Record<string, string>;
  try {
    argMap = parseArgs(Deno.args);
  } catch (err) {
    console.error(`[auth:create-reg-code] ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }

  let expiresInMs: number | null;
  try {
    expiresInMs = parseDuration(argMap['expires-in']);
  } catch (err) {
    console.error(`[auth:create-reg-code] ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }

  const maxUsesRaw = argMap['max-uses'];
  const maxUses = maxUsesRaw ? Math.max(1, Math.floor(Number(maxUsesRaw))) : 1;
  if (!Number.isFinite(maxUses) || maxUses < 1) {
    console.error('[auth:create-reg-code] --max-uses must be a positive integer');
    Deno.exit(1);
  }

  const createdBy = argMap['created-by'] ?? 'system';
  const kvPath = argMap['kv'] ?? Deno.env.get('AUTH_KV_PATH') ?? './game-data/auth.kv';

  console.log(`[auth:create-reg-code] opening KV at '${kvPath}'`);
  const store = new DenoKvRegistrationCodeStore(consoleLogger);
  await store.open(kvPath);

  const now = Date.now();
  const expiresAt = expiresInMs !== null ? now + expiresInMs : null;

  const rec = store.create({ createdBy, expiresAt, maxUses, now });

  // Wait briefly so the fire-and-forget KV write completes before exit.
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('[auth:create-reg-code] created registration code:');
  console.log(`  code:      ${rec.code}`);
  console.log(`  createdBy: ${rec.createdBy}`);
  console.log(`  expiresAt: ${rec.expiresAt ?? 'never'}`);
  console.log(`  maxUses:   ${rec.maxUses}`);
  Deno.exit(0);
};

await main();
