import type { SupabaseClient } from '@supabase/supabase-js';
import { LoggerService } from '../logger-service.ts';
import type { PasswordAlgo } from './password-hasher.ts';
import type { UserRecord, UserStore } from './user-store.ts';

/**
 * Sentinel id used for synthesized dev-bypass users.
 *
 * Negative so it can never collide with a real backing-store id (those are
 * positive). Under the bypass, write paths that key off id (recordFailure,
 * setLockedUntil, etc.) are never reached because UserAccountAuthProvider
 * short-circuits authentication before any failure bookkeeping, so a shared
 * sentinel id across synthetic users is harmless.
 */
export const DEV_BYPASS_SYNTHETIC_USER_ID = -1;

/**
 * UserStore decorator that backs the local-development authentication bypass.
 *
 * Wraps a real {@link UserStore} and changes exactly one behaviour:
 * `getByUsername` returns a synthesized admin identity when the wrapped store
 * has no record for that username. Every other method delegates unchanged to
 * the wrapped store.
 *
 * This is the single chokepoint that makes the bypass coherent across the
 * whole server: login, token validation, the lobby email gate, and the debug
 * admin check all resolve a user via `getByUsername`, so synthesizing a
 * non-null-email admin record here means all of those flows accept a
 * dev-bypass login without any per-consumer special-casing.
 *
 * The synthetic record is never persisted. `getById` / `getByEmail` are NOT
 * synthesized — only the username path matters for the login/identity flow,
 * and leaving the others as pass-throughs keeps registration-style lookups
 * honest.
 *
 * Lifetime: Root singleton — only instantiated (wrapping the real store) when
 * `ServerConfigService.isAuthDevBypassEnabled()` is true.
 *
 * Defined in: server/src/core/auth/dev-bypass-user-store.ts
 * Consumers: Wired in register-root-services.ts (userStore factory) when the
 *   dev bypass is enabled; injected everywhere a UserStore is injected.
 */
export class DevBypassUserStore implements UserStore {
  constructor(
    private readonly inner: UserStore,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Returns the real record when present, otherwise a synthesized dev admin.
   *
   * The synthetic identity carries a non-null email (so the lobby email gate
   * and the `needsEmail` flag pass), `isAdmin: true` (so the debug overlay and
   * admin-only endpoints are reachable in dev), and a null `supabaseAuthId`
   * (so token validation skips the Supabase ban check).
   */
  public async getByUsername(username: string): Promise<UserRecord | undefined> {
    const real = await this.inner.getByUsername(username);
    if (real) {
      return real;
    }

    // No backing record — synthesize a throwaway admin identity for dev.
    this.loggerService.warn(
      `[auth:dev-bypass] no stored user for '${username}'; synthesizing a dev admin identity (AUTH_DEV_BYPASS)`,
    );
    return this.makeSyntheticUser(username);
  }

  /**
   * Forwards the Supabase-specific `open(client)` lifecycle call to the wrapped
   * store.
   *
   * `open()` is NOT part of the {@link UserStore} interface — it is a
   * backend-specific hook that `ServerStartupService` invokes on the concrete
   * store (cast to `SupabaseUserStore`) when STORAGE_BACKEND=supabase. Because
   * this decorator sits in front of that concrete store, the cast resolves to
   * this method at runtime, so it must delegate through. Duck-typed: wrapping a
   * store without `open()` (e.g. the in-memory store) is a safe no-op.
   */
  public open(client: SupabaseClient): void {
    const inner = this.inner as { open?: (client: SupabaseClient) => void };
    inner.open?.(client);
  }

  // The remaining methods are pure pass-throughs to the wrapped store.

  public getById(id: number): Promise<UserRecord | undefined> {
    return this.inner.getById(id);
  }

  public getByEmail(email: string): Promise<UserRecord | undefined> {
    return this.inner.getByEmail(email);
  }

  public create(args: {
    username: string;
    email?: string | null;
    passwordHash: string;
    passwordAlgo: 'argon2id';
    now: number;
    supabaseAuthId?: string | null;
  }): Promise<UserRecord> {
    return this.inner.create(args);
  }

  public updatePassword(id: number, passwordHash: string, algo: PasswordAlgo, now: number): void {
    this.inner.updatePassword(id, passwordHash, algo, now);
  }

  public recordFailure(id: number, now: number): Promise<UserRecord> {
    return this.inner.recordFailure(id, now);
  }

  public resetFailures(id: number): void {
    this.inner.resetFailures(id);
  }

  public setLockedUntil(id: number, until: number | null): void {
    this.inner.setLockedUntil(id, until);
  }

  public setDisabled(id: number, disabled: boolean): void {
    this.inner.setDisabled(id, disabled);
  }

  public setAdmin(id: number, isAdmin: boolean): void {
    this.inner.setAdmin(id, isAdmin);
  }

  public setEmail(id: number, email: string, now: number): void {
    this.inner.setEmail(id, email, now);
  }

  public setSupabaseAuthId(id: number, authId: string | null): void {
    this.inner.setSupabaseAuthId(id, authId);
  }

  public delete(id: number): void {
    this.inner.delete(id);
  }

  public clear(): void {
    this.inner.clear();
  }

  public list(): Promise<ReadonlyArray<UserRecord>> {
    return this.inner.list();
  }

  /**
   * Builds the synthetic dev admin record for a username.
   *
   * The email is derived deterministically from the username so the same dev
   * login always resolves to the same display values across page refreshes.
   */
  private makeSyntheticUser(username: string): UserRecord {
    return {
      id: DEV_BYPASS_SYNTHETIC_USER_ID,
      username,
      email: `${username.toLowerCase()}@dev.local`,
      passwordHash: '',
      passwordAlgo: 'argon2id',
      passwordUpdatedAt: 0,
      failedAttempts: 0,
      lockedUntil: null,
      disabled: false,
      isAdmin: true,
      createdAt: 0,
      supabaseAuthId: null,
    };
  }
}
