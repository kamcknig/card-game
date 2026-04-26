import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoggerService } from '../logger-service.ts';
import type { RegistrationCode, RegistrationCodeStore } from './registration-code-store.ts';

/**
 * Length (hex characters) of the code value produced by {@link generateCode}.
 *
 * 32 hex chars = 128 bits of entropy — high enough to make brute-forcing
 * infeasible against the IP-based rate limiter.
 */
const CODE_LENGTH_HEX = 32;

/**
 * Generates a cryptographically random hex code suitable for registration use.
 */
const generateCode = (): string => {
  const bytes = new Uint8Array(CODE_LENGTH_HEX / 2);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Shape of a row in the `auth_registration_codes` Supabase table.
 */
type DbRegistrationCodeRow = {
  code: string;
  created_at: number;
  created_by: string;
  expires_at: number | null;
  max_uses: number;
  used_count: number;
  disabled: boolean;
};

/**
 * Maps a database row to the in-memory {@link RegistrationCode} shape.
 */
function rowToRecord(row: DbRegistrationCodeRow): RegistrationCode {
  return {
    code: row.code,
    createdAt: row.created_at,
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    disabled: row.disabled,
  };
}

/**
 * Maps an in-memory {@link RegistrationCode} to a full DB row.
 */
function recordToRow(rec: RegistrationCode): DbRegistrationCodeRow {
  return {
    code: rec.code,
    created_at: rec.createdAt,
    created_by: rec.createdBy,
    expires_at: rec.expiresAt,
    max_uses: rec.maxUses,
    used_count: rec.usedCount,
    disabled: rec.disabled,
  };
}

/**
 * Supabase-backed implementation of {@link RegistrationCodeStore}.
 *
 * Uses the same write-through cache pattern as {@link DenoKvRegistrationCodeStore}:
 * reads are served from a synchronous in-memory `Map`; mutations update the
 * cache immediately and fire async Supabase writes in the background.
 *
 * Unlike the session store, all registration codes are loaded on `open()`
 * regardless of expiry — expired codes are still useful for the admin list
 * endpoint and are cleaned up by `purgeExpired()`.
 *
 * Defined in: server/src/core/auth/supabase-registration-code-store.ts
 * Consumers: Registered as `registrationCodeStore` in register-root-services.ts
 *   when STORAGE_BACKEND=supabase. `open()` is called from ServerStartupService.
 */
export class SupabaseRegistrationCodeStore implements RegistrationCodeStore {
  // Write-through cache keyed by code value.
  private readonly cache = new Map<string, RegistrationCode>();

  // Shared Supabase client; set in open().
  private client: SupabaseClient | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Loads all registration code rows from the `auth_registration_codes` table.
   *
   * Does not filter by expiry — all codes are loaded so the admin list includes
   * expired ones. Must be called once during server startup.
   */
  public async open(client: SupabaseClient): Promise<void> {
    this.client = client;

    const { data, error } = await this.client.from('auth_registration_codes').select('*');
    if (error) {
      throw new Error(`[auth reg codes] failed to load from Supabase: ${error.message}`);
    }

    let loaded = 0;
    for (const row of (data ?? []) as DbRegistrationCodeRow[]) {
      const rec = rowToRecord(row);
      this.cache.set(rec.code, rec);
      loaded++;
    }

    this.loggerService.info(`[auth reg codes] loaded ${loaded} registration code(s) from Supabase`);
  }

  /**
   * Returns the code record or undefined when unknown.
   */
  public get(code: string): RegistrationCode | undefined {
    return this.cache.get(code);
  }

  /**
   * Creates a new registration code with a freshly generated random value.
   *
   * Updates the cache synchronously and fires an async DB insert.
   */
  public create(args: {
    createdBy: string;
    expiresAt: number | null;
    maxUses: number;
    now: number;
  }): RegistrationCode {
    // In the extremely unlikely event of a collision, regenerate. With 128-bit
    // entropy this loop will terminate on the first iteration in practice.
    let code = generateCode();
    while (this.cache.has(code)) {
      code = generateCode();
    }

    const rec: RegistrationCode = {
      code,
      createdAt: args.now,
      createdBy: args.createdBy,
      expiresAt: args.expiresAt,
      maxUses: args.maxUses,
      usedCount: 0,
      disabled: false,
    };

    this.cache.set(code, rec);
    this.persist(rec);
    return rec;
  }

  /**
   * Validates and atomically records a successful use of the given code.
   *
   * Returns the updated record when the code was accepted (incremented
   * `usedCount`). Returns undefined when the code is missing, disabled,
   * expired, or exhausted. Auto-disables when the last use is consumed.
   */
  public recordUse(code: string, nowMs: number): RegistrationCode | undefined {
    const rec = this.cache.get(code);
    if (!rec) return undefined;
    if (rec.disabled) return undefined;
    if (rec.expiresAt !== null && rec.expiresAt <= nowMs) return undefined;
    if (rec.usedCount >= rec.maxUses) return undefined;

    rec.usedCount++;

    // Auto-disable when the last use is consumed so subsequent attempts
    // short-circuit on the `disabled` flag rather than a usedCount comparison.
    if (rec.usedCount >= rec.maxUses) {
      rec.disabled = true;
    }

    this.persist(rec);
    return rec;
  }

  /**
   * Disables the given code (no-op when already disabled or missing).
   */
  public disable(code: string): void {
    const rec = this.cache.get(code);
    if (!rec || rec.disabled) return;
    rec.disabled = true;
    this.persist(rec);
  }

  /**
   * Returns a snapshot of every registration code currently persisted.
   */
  public list(): ReadonlyArray<RegistrationCode> {
    return [...this.cache.values()];
  }

  /**
   * Removes all codes whose `expiresAt` is <= nowMs from both cache and DB.
   *
   * Returns the purge count. The DB delete uses a server-side filter to clean
   * rows atomically in one round-trip.
   */
  public purgeExpired(nowMs: number): number {
    let removed = 0;

    for (const [code, rec] of this.cache) {
      if (rec.expiresAt !== null && rec.expiresAt <= nowMs) {
        this.cache.delete(code);
        removed++;
      }
    }

    if (removed > 0) {
      this.client
        ?.from('auth_registration_codes')
        .delete()
        .lte('expires_at', nowMs)
        .not('expires_at', 'is', null)
        .then(({ error }) => {
          if (error) {
            this.loggerService.warn(`[auth reg codes] purgeExpired DB delete failed: ${error.message}`);
          }
        });

      this.loggerService.debug(`[auth reg codes] purged ${removed} expired code(s) from cache`);
    }

    return removed;
  }

  /**
   * Upserts the current cached record back to the DB in the background.
   *
   * Mutations happen on the cached object in place before this is called;
   * this method echoes the updated state to the DB. Errors are logged.
   */
  private persist(rec: RegistrationCode): void {
    this.client
      ?.from('auth_registration_codes')
      .upsert(recordToRow(rec), { onConflict: 'code' })
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth reg codes] persist failed for code ${rec.code.slice(0, 6)}...: ${error.message}`);
        }
      });
  }
}
