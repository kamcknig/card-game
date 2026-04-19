/**
 * Bootstrap/maintenance CLI — manages user accounts in the Deno KV auth store.
 *
 * Usage:
 *   deno task auth:users <command> [options]
 *
 * Commands:
 *   create        Create a new user account
 *   delete        Delete a user account by username
 *   set-password  Update a user's password
 *   clear         Delete all user accounts
 *
 * Run `deno task auth:users <command> --help` for command-specific options.
 *
 * Defined in: server/scripts/auth-user-mgmt.ts
 * Exposed as: `deno task auth:users` (see server/deno.json).
 */

import { DenoKvUserStore } from '../src/core/auth/deno-kv-user-store.ts';
import { Argon2idHasher } from '../src/core/auth/password-hasher.ts';
import type { LoggerService } from '../src/core/logger-service.ts';

// Minimal console-backed logger so we can reuse the auth store classes
// without depending on the full DI container.
const consoleLogger: LoggerService = {
  log: (...a: unknown[]) => console.log('[auth:users]', ...a),
  info: (...a: unknown[]) => console.log('[auth:users]', ...a),
  warn: (...a: unknown[]) => console.warn('[auth:users]', ...a),
  debug: () => {},
  error: (...a: unknown[]) => console.error('[auth:users]', ...a),
} as unknown as LoggerService;

// Short-form aliases for flag names (e.g. `-u` → `username`).
const ALIASES: Record<string, string> = {
  u: 'username',
  pw: 'password',
};

// Parses `--flag value` and `-flag value` pairs into a keyed map. Short-form
// aliases defined in ALIASES are normalized to their canonical key names.
// Does not support boolean flags or `--flag=value` syntax.
const parseArgs = (args: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) continue;
    const raw = arg.startsWith('--') ? arg.slice(2) : arg.slice(1);
    const key = ALIASES[raw] ?? raw;
    const value = args[i + 1];
    if (value === undefined || value.startsWith('-')) {
      throw new Error(`Missing value for ${arg}`);
    }
    out[key] = value;
    i++;
  }
  return out;
};

// Opens the KV store at the given path, creating the parent directory and KV
// file if they do not already exist. Exits with a clear error message when the
// store cannot be opened for any other reason (e.g. the file is corrupted).
const openStore = async (kvPath: string): Promise<DenoKvUserStore> => {
  console.log(`[auth:users] opening KV at '${kvPath}'`);

  const dir = kvPath.includes('/') ? kvPath.slice(0, kvPath.lastIndexOf('/')) : '.';
  await Deno.mkdir(dir, { recursive: true });

  const store = new DenoKvUserStore(consoleLogger);
  try {
    await store.open(kvPath);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[auth:users] could not open auth store at '${kvPath}': ${detail}`);
    Deno.exit(1);
  }
  return store;
};

// Brief pause so fire-and-forget KV writes flush before process exit.
const flushWrites = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 100));

const printGlobalHelp = (): void => {
  console.log(
    `Usage: deno task auth:users <command> [options]

Manages user accounts in the Deno KV auth store.

Commands:
  create        Create a new user account
  delete        Delete a user account by username
  set-password  Update a user's password
  clear         Delete all user accounts

Global options:
  --kv <path>   Path to KV file (default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h    Show this help message

Run \`deno task auth:users <command> --help\` for command-specific options.`,
  );
};

// --- create ---

const printCreateHelp = (): void => {
  console.log(
    `Usage: deno task auth:users create --username <name> --password <pw> [--kv <path>]

Creates a single user account directly in the Deno KV auth store without going
through the HTTP registration flow. Useful for seeding the first account before
any registration codes exist.

Options:
  --username, -u <name>   Username (3–32 chars, alphanumeric or underscore)
  --password, -pw <pw>    Plaintext password (hashed with argon2id before storage)
  --kv <path>             Path to KV file (default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h              Show this help message`,
  );
};

const runCreate = async (args: string[], kvPath: string): Promise<void> => {
  if (args.includes('--help') || args.includes('-h')) {
    printCreateHelp();
    return;
  }

  let argMap: Record<string, string>;
  try {
    argMap = parseArgs(args);
  } catch (err) {
    console.error(`[auth:users] ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }

  const username = argMap['username']?.trim();
  const password = argMap['password'];

  if (!username || !password) {
    console.error('[auth:users] create requires --username and --password');
    Deno.exit(1);
  }

  if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
    console.error('[auth:users] username must be 3-32 characters, alphanumeric or underscore');
    Deno.exit(1);
  }

  const store = await openStore(kvPath);

  if (store.getByUsername(username)) {
    console.error(`[auth:users] username '${username}' already exists`);
    Deno.exit(1);
  }

  console.log('[auth:users] hashing password with argon2id...');
  const hasher = new Argon2idHasher();
  const hash = await hasher.hash(password);

  const rec = store.create({ username, passwordHash: hash, passwordAlgo: 'argon2id', now: Date.now() });
  await flushWrites();
  console.log(`[auth:users] created user id=${rec.id} username='${rec.username}'`);
};

// --- delete ---

const printDeleteHelp = (): void => {
  console.log(
    `Usage: deno task auth:users delete --username <name> [--kv <path>]

Permanently removes the user account with the given username.

Options:
  --username, -u <name>   Username of the account to delete
  --kv <path>             Path to KV file (default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h              Show this help message`,
  );
};

const runDelete = async (args: string[], kvPath: string): Promise<void> => {
  if (args.includes('--help') || args.includes('-h')) {
    printDeleteHelp();
    return;
  }

  let argMap: Record<string, string>;
  try {
    argMap = parseArgs(args);
  } catch (err) {
    console.error(`[auth:users] ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }

  const username = argMap['username']?.trim();
  if (!username) {
    console.error('[auth:users] delete requires --username');
    Deno.exit(1);
  }

  const store = await openStore(kvPath);
  const rec = store.getByUsername(username);
  if (!rec) {
    console.error(`[auth:users] username '${username}' not found`);
    Deno.exit(1);
  }

  store.delete(rec.id);
  await flushWrites();
  console.log(`[auth:users] deleted user id=${rec.id} username='${rec.username}'`);
};

// --- set-password ---

const printSetPasswordHelp = (): void => {
  console.log(
    `Usage: deno task auth:users set-password --username <name> --password <pw> [--kv <path>]

Replaces the password for an existing user account. Resets any active lockout
and failure counter.

Options:
  --username, -u <name>   Username of the target account
  --password, -pw <pw>    New plaintext password (hashed with argon2id before storage)
  --kv <path>             Path to KV file (default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h              Show this help message`,
  );
};

const runSetPassword = async (args: string[], kvPath: string): Promise<void> => {
  if (args.includes('--help') || args.includes('-h')) {
    printSetPasswordHelp();
    return;
  }

  let argMap: Record<string, string>;
  try {
    argMap = parseArgs(args);
  } catch (err) {
    console.error(`[auth:users] ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }

  const username = argMap['username']?.trim();
  const password = argMap['password'];

  if (!username || !password) {
    console.error('[auth:users] set-password requires --username and --password');
    Deno.exit(1);
  }

  const store = await openStore(kvPath);
  const rec = store.getByUsername(username);
  if (!rec) {
    console.error(`[auth:users] username '${username}' not found`);
    Deno.exit(1);
  }

  console.log('[auth:users] hashing password with argon2id...');
  const hasher = new Argon2idHasher();
  const hash = await hasher.hash(password);
  store.updatePassword(rec.id, hash, 'argon2id', Date.now());
  await flushWrites();
  console.log(`[auth:users] updated password for username='${rec.username}'`);
};

// --- clear ---

const printClearHelp = (): void => {
  console.log(
    `Usage: deno task auth:users clear [--kv <path>]

Deletes every user account in the store. This action is irreversible.

Options:
  --kv <path>   Path to KV file (default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h    Show this help message`,
  );
};

const runClear = async (args: string[], kvPath: string): Promise<void> => {
  if (args.includes('--help') || args.includes('-h')) {
    printClearHelp();
    return;
  }

  const store = await openStore(kvPath);
  const count = store.list().length;
  store.clear();
  await flushWrites();
  console.log(`[auth:users] cleared ${count} user(s) from the store`);
};

// --- main ---

const main = async (): Promise<void> => {
  const [command, ...rest] = Deno.args;

  if (!command || command === '--help' || command === '-h') {
    printGlobalHelp();
    Deno.exit(0);
  }

  // Resolve --kv from the command's own args; fall back to env / default path.
  const kvPath = (() => {
    const idx = rest.indexOf('--kv');
    return idx !== -1 ? rest[idx + 1] : (Deno.env.get('AUTH_KV_PATH') ?? './game-data/auth.kv');
  })();

  switch (command) {
    case 'create':
      await runCreate(rest, kvPath);
      break;
    case 'delete':
      await runDelete(rest, kvPath);
      break;
    case 'set-password':
      await runSetPassword(rest, kvPath);
      break;
    case 'clear':
      await runClear(rest, kvPath);
      break;
    default:
      console.error(`[auth:users] unknown command '${command}'. Run with --help for usage.`);
      Deno.exit(1);
  }

  Deno.exit(0);
};

await main();
