/**
 * Bootstrap/maintenance CLI — creates a single user account directly in the
 * Deno KV auth store without going through the HTTP registration flow.
 *
 * Usage:
 *   deno task auth:create-user --username <name> --password <pw> [--kv <path>]
 *
 * Behavior:
 * - Opens the KV database at AUTH_KV_PATH (default `./game-data/auth.kv`) or
 *   the path supplied via `--kv`.
 * - Hashes the plaintext password with argon2id and inserts a UserRecord.
 * - Refuses to overwrite existing usernames (case-insensitive). Use the
 *   password-change endpoint for rotation.
 *
 * Used mainly to seed the very first account before any registration codes
 * exist. For day-to-day account creation, prefer the self-service HTTP flow.
 *
 * Defined in: server/scripts/auth-create-user.ts
 * Exposed as: `deno task auth:create-user` (see server/deno.json).
 */

import { DenoKvUserStore } from '../src/core/auth/deno-kv-user-store.ts';
import { Argon2idHasher } from '../src/core/auth/password-hasher.ts';
import type { LoggerService } from '../src/core/logger-service.ts';

// Prints usage information to stdout and exits with code 0.
const printHelp = (): void => {
  console.log(
    `Usage: deno task auth:create-user --username <name> --password <pw> [--kv <path>]

Creates a single user account directly in the Deno KV auth store without going
through the HTTP registration flow. Useful for seeding the first account before
any registration codes exist.

Options:
  --username <name>   Username (3–32 chars, alphanumeric or underscore)
  --password <pw>     Plaintext password (hashed with argon2id before storage)
  --kv <path>         Path to KV file (default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h          Show this help message`,
  );
};

// Parses a list of `--flag value` pairs into a keyed map. Only supports the
// shape this CLI needs (no boolean flags, no `--flag=value`).
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

// Minimal console-backed logger so we can reuse the auth store classes
// without depending on the full DI container.
const consoleLogger: LoggerService = {
  log: (...a: unknown[]) => console.log('[auth:create-user]', ...a),
  info: (...a: unknown[]) => console.log('[auth:create-user]', ...a),
  warn: (...a: unknown[]) => console.warn('[auth:create-user]', ...a),
  debug: () => {},
  error: (...a: unknown[]) => console.error('[auth:create-user]', ...a),
} as unknown as LoggerService;

const main = async (): Promise<void> => {
  if (Deno.args.includes('--help') || Deno.args.includes('-h')) {
    printHelp();
    Deno.exit(0);
  }

  let argMap: Record<string, string>;
  try {
    argMap = parseArgs(Deno.args);
  } catch (err) {
    console.error(`[auth:create-user] ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }

  const username = argMap['username']?.trim();
  const password = argMap['password'];
  const kvPath = argMap['kv'] ?? Deno.env.get('AUTH_KV_PATH') ?? './game-data/auth.kv';

  if (!username || !password) {
    console.error('[auth:create-user] usage: --username <name> --password <pw> [--kv <path>]');
    Deno.exit(1);
  }

  if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
    console.error('[auth:create-user] username must be 3-32 characters, alphanumeric or underscore');
    Deno.exit(1);
  }

  console.log(`[auth:create-user] opening KV at '${kvPath}'`);
  const store = new DenoKvUserStore(consoleLogger);
  await store.open(kvPath);

  if (store.getByUsername(username)) {
    console.error(`[auth:create-user] username '${username}' already exists`);
    Deno.exit(1);
  }

  console.log('[auth:create-user] hashing password with argon2id...');
  const hasher = new Argon2idHasher();
  const hash = await hasher.hash(password);

  const rec = store.create({
    username,
    passwordHash: hash,
    passwordAlgo: 'argon2id',
    now: Date.now(),
  });

  // Give the fire-and-forget KV writes a moment to flush before exiting.
  // The store does not expose a flush API; this short delay is sufficient for
  // the single set() triggered by create().
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log(`[auth:create-user] created user id=${rec.id} username='${rec.username}'`);
  Deno.exit(0);
};

await main();
