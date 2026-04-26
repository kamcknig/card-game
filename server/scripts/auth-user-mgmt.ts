/**
 * Bootstrap/maintenance CLI — manages user accounts in the auth store.
 *
 * Supports both the Deno KV backend (STORAGE_BACKEND=kv) and the Supabase
 * backend (STORAGE_BACKEND=supabase). The backend is selected via the
 * STORAGE_BACKEND environment variable; KV path (--kv / AUTH_KV_PATH) is
 * only used when backend is 'kv'.
 *
 * Usage:
 *   deno task auth:users <command> [options]
 *
 * Commands:
 *   create        Create a new user account
 *   delete        Delete a user account by username
 *   set-password  Update a user's password
 *   set-admin     Grant or revoke admin privileges for a user
 *   set-email     Set the email address for an existing user
 *   list          List all user accounts
 *   clear         Delete all user accounts
 *
 * Run `deno task auth:users <command> --help` for command-specific options.
 *
 * Defined in: server/scripts/auth-user-mgmt.ts
 * Exposed as: `deno task auth:users` (see server/deno.json).
 */

import { DenoKvUserStore } from '../src/core/auth/deno-kv-user-store.ts';
import { SupabaseUserStore } from '../src/core/auth/supabase-user-store.ts';
import { SupabaseClientProvider } from '../src/core/storage/supabase-client-provider.ts';
import { Argon2idHasher } from '../src/core/auth/password-hasher.ts';
import type { UserStore } from '../src/core/auth/user-store.ts';
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

/**
 * Opens the KV store at the given path, creating the parent directory and KV
 * file if they do not already exist. Exits with a clear error message when the
 * store cannot be opened for any other reason (e.g. the file is corrupted).
 */
const openKvStore = async (kvPath: string): Promise<UserStore> => {
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

/**
 * Opens the Supabase-backed user store using the given URL and service-role key.
 * Exits with a clear error message if the store cannot be opened.
 */
const openSupabaseStore = async (url: string, key: string): Promise<UserStore> => {
  console.log(`[auth:users] opening Supabase store at '${url}'`);

  const provider = new SupabaseClientProvider(consoleLogger);
  provider.open(url, key);
  const client = provider.get();

  const store = new SupabaseUserStore(consoleLogger);
  try {
    await store.open(client);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[auth:users] could not open Supabase auth store: ${detail}`);
    Deno.exit(1);
  }
  return store;
};

/**
 * Resolves the backend from STORAGE_BACKEND env and returns an opened UserStore.
 * For 'kv', opens the KV file at kvPath. For 'supabase', opens a Supabase client.
 * Throws on unrecognized STORAGE_BACKEND values.
 */
const openStore = async (kvPath: string): Promise<UserStore> => {
  const backend = Deno.env.get('STORAGE_BACKEND')?.trim().toLowerCase();

  if (backend === 'supabase') {
    const url = Deno.env.get('SUPABASE_URL');
    const roleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !roleKey) {
      console.error('[auth:users] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when STORAGE_BACKEND=supabase');
      Deno.exit(1);
    }
    return openSupabaseStore(url, roleKey);
  }

  if (backend === 'kv') {
    return openKvStore(kvPath);
  }

  throw new Error(`[auth:users] STORAGE_BACKEND must be 'kv' or 'supabase', received '${backend ?? '(unset)'}'`);
};

// Brief pause so fire-and-forget KV writes flush before process exit.
const flushWrites = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 100));

const printGlobalHelp = (): void => {
  console.log(
    `Usage: deno task auth:users <command> [options]

Manages user accounts in the auth store (KV or Supabase).

Backend is selected via STORAGE_BACKEND env var ('kv' or 'supabase').
  - kv:       requires --kv <path> or AUTH_KV_PATH env (default: ./game-data/auth.kv)
  - supabase: requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars

Commands:
  create        Create a new user account
  delete        Delete a user account by username
  set-password  Update a user's password
  set-admin     Grant or revoke admin privileges for a user
  set-email     Set the email address for an existing user (operator override)
  list          List all user accounts
  clear         Delete all user accounts

Global options:
  --kv <path>   Path to KV file (kv backend only; default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h    Show this help message

Run \`deno task auth:users <command> --help\` for command-specific options.`,
  );
};

// --- create ---

const printCreateHelp = (): void => {
  console.log(
    `Usage: deno task auth:users create --username <name> --password <pw> [--email <addr>] [--admin true|false] [--kv <path>]

Creates a single user account directly in the auth store without going through
the HTTP registration flow. Useful for seeding accounts and creating legacy
users without an email (omit --email to leave email null).

Options:
  --username, -u <name>     Username (3–32 chars, alphanumeric or underscore)
  --password, -pw <pw>      Plaintext password (hashed with argon2id before storage)
  --email <addr>            Email address (optional; null when omitted)
  --admin <true|false>      Grant admin privileges immediately (default: false)
  --kv <path>               Path to KV file (default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h                Show this help message`,
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

  // Optional email — null when not supplied.
  const email = argMap['email']?.trim() ?? null;

  const store = await openStore(kvPath);

  if (await store.getByUsername(username)) {
    console.error(`[auth:users] username '${username}' already exists`);
    Deno.exit(1);
  }

  // Guard against duplicate email before hashing the password.
  if (email && await store.getByEmail(email)) {
    console.error(`[auth:users] email '${email}' already exists`);
    Deno.exit(1);
  }

  console.log('[auth:users] hashing password with argon2id...');
  const hasher = new Argon2idHasher();
  const hash = await hasher.hash(password);

  const rec = await store.create({ username, email, passwordHash: hash, passwordAlgo: 'argon2id', now: Date.now() });
  const makeAdmin = argMap['admin'] === 'true';
  if (makeAdmin) {
    store.setAdmin(rec.id, true);
  }
  await flushWrites();
  console.log(`[auth:users] created user id=${rec.id} username='${rec.username}' email=${rec.email ?? 'null'} isAdmin=${makeAdmin}`);
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
  const rec = await store.getByUsername(username);
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
  const rec = await store.getByUsername(username);
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

// --- set-admin ---

const printSetAdminHelp = (): void => {
  console.log(
    `Usage: deno task auth:users set-admin --username <name> --admin <true|false> [--kv <path>]

Grants or revokes admin privileges for an existing user account. Admin users may
create, list, and disable registration codes, and have access to the debug overlay.
Promotion is operator-only; there is no HTTP API for this operation.

Options:
  --username, -u <name>     Username of the target account
  --admin <true|false>      true to grant admin, false to revoke
  --kv <path>               Path to KV file (default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h                Show this help message`,
  );
};

const runSetAdmin = async (args: string[], kvPath: string): Promise<void> => {
  if (args.includes('--help') || args.includes('-h')) {
    printSetAdminHelp();
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
  const adminValue = argMap['admin'];

  if (!username || adminValue === undefined) {
    console.error('[auth:users] set-admin requires --username and --admin <true|false>');
    Deno.exit(1);
  }

  if (adminValue !== 'true' && adminValue !== 'false') {
    console.error(`[auth:users] --admin must be 'true' or 'false', got '${adminValue}'`);
    Deno.exit(1);
  }

  const flag = adminValue === 'true';
  const store = await openStore(kvPath);
  const rec = await store.getByUsername(username);
  if (!rec) {
    console.error(`[auth:users] username '${username}' not found`);
    Deno.exit(1);
  }

  store.setAdmin(rec.id, flag);
  await flushWrites();
  console.log(`[auth:users] user '${rec.username}' isAdmin=${flag}`);
};

// --- set-email ---

const printSetEmailHelp = (): void => {
  console.log(
    `Usage: deno task auth:users set-email --username <name> --email <addr> [--kv <path>]

Sets the email address for an existing user account. Intended for operator
overrides. The user must not already have an email — email changes are out of
scope for this plan.

Options:
  --username, -u <name>   Username of the target account
  --email <addr>          New email address
  --kv <path>             Path to KV file (default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h              Show this help message`,
  );
};

const runSetEmail = async (args: string[], kvPath: string): Promise<void> => {
  if (args.includes('--help') || args.includes('-h')) {
    printSetEmailHelp();
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
  const email = argMap['email']?.trim();

  if (!username || !email) {
    console.error('[auth:users] set-email requires --username and --email');
    Deno.exit(1);
  }

  const store = await openStore(kvPath);
  const rec = await store.getByUsername(username);
  if (!rec) {
    console.error(`[auth:users] username '${username}' not found`);
    Deno.exit(1);
  }

  try {
    store.setEmail(rec.id, email, Date.now());
  } catch (err) {
    console.error(`[auth:users] ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }

  await flushWrites();
  console.log(`[auth:users] set email for username='${rec.username}' email='${email}'`);
};

// --- list ---

const printListHelp = (): void => {
  console.log(
    `Usage: deno task auth:users list [--kv <path>]

Lists all user accounts in the store, including id, username, email, admin
status, and disabled status.

Options:
  --kv <path>   Path to KV file (default: AUTH_KV_PATH env or ./game-data/auth.kv)
  --help, -h    Show this help message`,
  );
};

const runList = async (args: string[], kvPath: string): Promise<void> => {
  if (args.includes('--help') || args.includes('-h')) {
    printListHelp();
    return;
  }

  const store = await openStore(kvPath);
  const users = await store.list();

  if (users.length === 0) {
    console.log('[auth:users] no users found');
    return;
  }

  // Print a simple table header.
  console.log(`${'id'.padEnd(6)} ${'username'.padEnd(24)} ${'email'.padEnd(40)} ${'admin'.padEnd(6)} disabled`);
  console.log('-'.repeat(90));

  for (const u of users) {
    console.log(
      `${String(u.id).padEnd(6)} ${u.username.padEnd(24)} ${(u.email ?? 'null').padEnd(40)} ${String(u.isAdmin).padEnd(6)} ${u.disabled}`,
    );
  }
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
  const count = (await store.list()).length;
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
    case 'set-admin':
      await runSetAdmin(rest, kvPath);
      break;
    case 'set-email':
      await runSetEmail(rest, kvPath);
      break;
    case 'list':
      await runList(rest, kvPath);
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
