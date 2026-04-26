/**
 * One-shot migration script — lifts existing Deno KV rows into Supabase.
 *
 * Reads AUTH_KV_PATH, GAME_DATA_KV_PATH, SUPABASE_URL, and
 * SUPABASE_SERVICE_ROLE_KEY from the environment. Opens both KV files
 * read-only and iterates the four key prefixes used by the server's KV
 * stores. Each batch of rows is upserted into the corresponding Supabase
 * table using onConflict so the script is fully idempotent — safe to
 * re-run without producing duplicates or overwriting diverged data.
 *
 * After migrating auth_users, the script prints the SQL setval statement
 * needed to advance the DB identity sequence past the highest id seen, so
 * the operator can run it in Supabase Studio or via psql to prevent future
 * inserts from colliding with migrated rows.
 *
 * Per-table counts are printed to stdout on success. The process exits
 * non-zero on any error so it can be used safely in CI or operator runbooks.
 *
 * Usage:
 *   deno task migrate-kv-to-supabase
 *
 * Required env vars:
 *   AUTH_KV_PATH               — path to the auth KV file (auth.kv)
 *   GAME_DATA_KV_PATH          — path to the game data KV file (game-data.kv)
 *   SUPABASE_URL               — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service-role secret key
 *
 * Defined in: server/scripts/migrate-kv-to-supabase.ts
 * Exposed as: `deno task migrate-kv-to-supabase` (see server/deno.json).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types — mirroring the KV value shapes for type-safe iteration
// ---------------------------------------------------------------------------

/** Shape stored in KV under ['auth_users', usernameLower]. */
type KvUserRecord = {
  id: number;
  username: string;
  passwordHash: string;
  passwordAlgo: string;
  passwordUpdatedAt: number;
  failedAttempts: number;
  lockedUntil: number | null;
  disabled: boolean;
  isAdmin: boolean;
  createdAt: number;
};

/** Shape stored in KV under ['auth_sessions', token]. */
type KvSessionRecord = {
  token: string;
  username: string;
  providerName: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  createdFromIp: string | undefined;
  createdFromUserAgent: string | undefined;
};

/** Shape stored in KV under ['auth_reg_codes', code]. */
type KvRegistrationCode = {
  code: string;
  createdAt: number;
  createdBy: string;
  expiresAt: number | null;
  maxUses: number;
  usedCount: number;
  disabled: boolean;
};

/** Shape stored in KV under ['match_config_saves', usernameLower, normalizedKey]. */
type KvMatchConfigSave = {
  name: string;
  savedAtMs: number;
  configuration: unknown;
};

// ---------------------------------------------------------------------------
// KV key prefix constants — must match the server's KV store implementations
// ---------------------------------------------------------------------------

/** Prefix for user records: full keys are ['auth_users', usernameLower]. */
const KV_KEY_USERS = 'auth_users';

/** Prefix for sessions: full keys are ['auth_sessions', token]. */
const KV_KEY_SESSIONS = 'auth_sessions';

/** Prefix for registration codes: full keys are ['auth_reg_codes', code]. */
const KV_KEY_REG_CODES = 'auth_reg_codes';

/** Prefix for match config saves: full keys are ['match_config_saves', usernameLower, saveKey]. */
const KV_KEY_MATCH_SAVES = 'match_config_saves';

// ---------------------------------------------------------------------------
// Migration helpers
// ---------------------------------------------------------------------------

/**
 * Migrates all user rows from the auth KV store to the `auth_users` Supabase table.
 *
 * Uses INSERT with `onConflict: 'username_lower'` so re-runs are idempotent.
 * After inserting, prints the setval SQL statement to stdout so the operator can
 * advance the DB identity sequence past the highest migrated id.
 *
 * Returns the number of rows upserted.
 */
async function migrateUsers(authKv: Deno.Kv, client: SupabaseClient): Promise<number> {
  // Collect all user rows from KV.
  const rows: {
    username: string;
    username_lower: string;
    password_hash: string;
    password_algo: string;
    password_updated_at: number;
    failed_attempts: number;
    locked_until: number | null;
    disabled: boolean;
    is_admin: boolean;
    created_at: number;
    supabase_auth_id: null;
  }[] = [];

  let maxId = 0;

  for await (const entry of authKv.list<KvUserRecord>({ prefix: [KV_KEY_USERS] })) {
    const rec = entry.value;
    if (!rec || typeof rec !== 'object') continue;

    rows.push({
      username: rec.username,
      username_lower: rec.username.toLowerCase(),
      password_hash: rec.passwordHash,
      password_algo: rec.passwordAlgo,
      password_updated_at: rec.passwordUpdatedAt,
      failed_attempts: rec.failedAttempts,
      locked_until: rec.lockedUntil,
      disabled: rec.disabled,
      is_admin: rec.isAdmin,
      created_at: rec.createdAt,
      // supabase_auth_id is NULL for all password-based users.
      supabase_auth_id: null,
    });

    if (rec.id > maxId) {
      maxId = rec.id;
    }
  }

  if (rows.length === 0) {
    console.log('[migrate] auth_users: no rows to migrate');
    return 0;
  }

  // Upsert into Supabase; onConflict on username_lower so re-runs are safe.
  const { error } = await client.from('auth_users').upsert(rows, { onConflict: 'username_lower' });
  if (error) {
    throw new Error(`[migrate] auth_users upsert failed: ${error.message}`);
  }

  // Print the setval SQL so the operator can advance the identity sequence past
  // the highest migrated id. This must be run in Supabase Studio / psql after
  // migration to prevent subsequent INSERTs from colliding with migrated rows.
  // The sequence name follows the Supabase default for INTEGER GENERATED BY DEFAULT AS IDENTITY.
  console.log('');
  console.log('-- Run the following SQL in Supabase Studio after migration to advance the auth_users id sequence:');
  console.log(`SELECT setval(pg_get_serial_sequence('auth_users', 'id'), ${maxId}, true);`);
  console.log('');

  return rows.length;
}

/**
 * Migrates all session rows from the auth KV store to the `auth_sessions` Supabase table.
 *
 * All rows are migrated regardless of expiry — the session store itself filters
 * on `expires_at` at runtime. Uses `onConflict: 'token'` for idempotence.
 *
 * Returns the number of rows upserted.
 */
async function migrateSessions(authKv: Deno.Kv, client: SupabaseClient): Promise<number> {
  const rows: {
    token: string;
    username: string;
    provider_name: string;
    created_at: number;
    last_activity_at: number;
    expires_at: number;
    created_from_ip: string | null;
    created_from_user_agent: string | null;
  }[] = [];

  for await (const entry of authKv.list<KvSessionRecord>({ prefix: [KV_KEY_SESSIONS] })) {
    const rec = entry.value;
    if (!rec || typeof rec !== 'object') continue;

    rows.push({
      token: rec.token,
      username: rec.username,
      provider_name: rec.providerName,
      created_at: rec.createdAt,
      last_activity_at: rec.lastActivityAt,
      expires_at: rec.expiresAt,
      created_from_ip: rec.createdFromIp ?? null,
      created_from_user_agent: rec.createdFromUserAgent ?? null,
    });
  }

  if (rows.length === 0) {
    console.log('[migrate] auth_sessions: no rows to migrate');
    return 0;
  }

  const { error } = await client.from('auth_sessions').upsert(rows, { onConflict: 'token' });
  if (error) {
    throw new Error(`[migrate] auth_sessions upsert failed: ${error.message}`);
  }

  return rows.length;
}

/**
 * Migrates all registration code rows from the auth KV store to the
 * `auth_registration_codes` Supabase table.
 *
 * Uses `onConflict: 'code'` for idempotence.
 *
 * Returns the number of rows upserted.
 */
async function migrateRegistrationCodes(authKv: Deno.Kv, client: SupabaseClient): Promise<number> {
  const rows: {
    code: string;
    created_at: number;
    created_by: string;
    expires_at: number | null;
    max_uses: number;
    used_count: number;
    disabled: boolean;
  }[] = [];

  for await (const entry of authKv.list<KvRegistrationCode>({ prefix: [KV_KEY_REG_CODES] })) {
    const rec = entry.value;
    if (!rec || typeof rec !== 'object') continue;

    rows.push({
      code: rec.code,
      created_at: rec.createdAt,
      created_by: rec.createdBy,
      expires_at: rec.expiresAt,
      max_uses: rec.maxUses,
      used_count: rec.usedCount,
      disabled: rec.disabled,
    });
  }

  if (rows.length === 0) {
    console.log('[migrate] auth_registration_codes: no rows to migrate');
    return 0;
  }

  const { error } = await client.from('auth_registration_codes').upsert(rows, { onConflict: 'code' });
  if (error) {
    throw new Error(`[migrate] auth_registration_codes upsert failed: ${error.message}`);
  }

  return rows.length;
}

/**
 * Migrates all match-configuration save rows from the game data KV store to the
 * `match_configuration_saves` Supabase table.
 *
 * KV key format: ['match_config_saves', usernameLower, normalizedKey].
 * Uses `onConflict: 'username_lower, save_key'` for idempotence.
 *
 * Returns the number of rows upserted.
 */
async function migrateMatchConfigSaves(gameDataKv: Deno.Kv, client: SupabaseClient): Promise<number> {
  const rows: {
    username_lower: string;
    save_key: string;
    display_name: string;
    data: unknown;
    created_at: number;
    updated_at: number;
  }[] = [];

  for await (const entry of gameDataKv.list<KvMatchConfigSave>({ prefix: [KV_KEY_MATCH_SAVES] })) {
    // Key format: [KV_KEY_MATCH_SAVES, usernameLower, normalizedKey]
    const key = entry.key as [string, string, string];
    const usernameLower = key[1];
    const saveKey = key[2];
    const rec = entry.value;

    if (!rec || typeof rec !== 'object' || !usernameLower || !saveKey) continue;
    if (!('configuration' in rec)) continue;

    rows.push({
      username_lower: usernameLower,
      save_key: saveKey,
      display_name: rec.name,
      data: rec.configuration,
      // KV saves do not track a separate created_at — use savedAtMs for both.
      created_at: rec.savedAtMs,
      updated_at: rec.savedAtMs,
    });
  }

  if (rows.length === 0) {
    console.log('[migrate] match_configuration_saves: no rows to migrate');
    return 0;
  }

  const { error } = await client
    .from('match_configuration_saves')
    .upsert(rows, { onConflict: 'username_lower, save_key' });
  if (error) {
    throw new Error(`[migrate] match_configuration_saves upsert failed: ${error.message}`);
  }

  return rows.length;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Main migration entry point.
 *
 * Validates env vars, opens both KV files and the Supabase client, then
 * runs each table migration in sequence. Prints a summary of inserted counts
 * and exits non-zero on any error.
 */
const main = async (): Promise<void> => {
  // --- Validate required environment variables ---
  const authKvPath = Deno.env.get('AUTH_KV_PATH');
  const gameDataKvPath = Deno.env.get('GAME_DATA_KV_PATH');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const missing: string[] = [];
  if (!authKvPath) missing.push('AUTH_KV_PATH');
  if (!gameDataKvPath) missing.push('GAME_DATA_KV_PATH');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.error(`[migrate] missing required environment variable(s): ${missing.join(', ')}`);
    Deno.exit(1);
  }

  // --- Open KV files ---
  // Both are opened read-only (no write permission required). We intentionally
  // use the path directly from env; deno --allow-read covers this.
  let authKv: Deno.Kv;
  let gameDataKv: Deno.Kv;

  try {
    console.log(`[migrate] opening auth KV at '${authKvPath!}'`);
    authKv = await Deno.openKv(authKvPath!);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[migrate] failed to open auth KV at '${authKvPath!}': ${detail}`);
    Deno.exit(1);
  }

  try {
    console.log(`[migrate] opening game-data KV at '${gameDataKvPath!}'`);
    gameDataKv = await Deno.openKv(gameDataKvPath!);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[migrate] failed to open game-data KV at '${gameDataKvPath!}': ${detail}`);
    authKv!.close();
    Deno.exit(1);
  }

  // --- Open Supabase client ---
  console.log(`[migrate] connecting to Supabase at '${supabaseUrl!}'`);
  const client = createClient(supabaseUrl!, supabaseKey!, {
    auth: { persistSession: false },
  });

  // --- Run migrations ---
  try {
    const usersInserted = await migrateUsers(authKv!, client);
    console.log(`[migrate] auth_users:                 ${usersInserted} row(s) upserted`);

    const sessionsInserted = await migrateSessions(authKv!, client);
    console.log(`[migrate] auth_sessions:              ${sessionsInserted} row(s) upserted`);

    const codesInserted = await migrateRegistrationCodes(authKv!, client);
    console.log(`[migrate] auth_registration_codes:    ${codesInserted} row(s) upserted`);

    const savesInserted = await migrateMatchConfigSaves(gameDataKv!, client);
    console.log(`[migrate] match_configuration_saves:  ${savesInserted} row(s) upserted`);

    console.log('[migrate] migration complete');
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[migrate] ${detail}`);
    authKv!.close();
    gameDataKv!.close();
    Deno.exit(1);
  }

  // --- Cleanup ---
  authKv!.close();
  gameDataKv!.close();
  Deno.exit(0);
};

await main();
