import type { LoggerService } from '../logger-service.ts';
import type { RegistrationCode, RegistrationCodeStore } from './registration-code-store.ts';

/**
 * Key prefix for all registration code rows — full keys are
 * `['auth_reg_codes', code]`.
 */
const KEY_PREFIX = 'auth_reg_codes';

/**
 * Length (hex characters) of the code value produced by {@link generateCode}.
 *
 * 32 hex chars = 128 bits of entropy — high enough to make brute-forcing
 * infeasible against the IP-based rate limiter.
 */
const CODE_LENGTH_HEX = 32;

/**
 * Generates a cryptographically random hex code suitable for registration use.
 *
 * Uses `crypto.getRandomValues` (Web Crypto API) so the value is unpredictable
 * even if the V8 Math.random PRNG is seeded.
 */
const generateCode = (): string => {
  const bytes = new Uint8Array(CODE_LENGTH_HEX / 2);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Deno KV-backed {@link RegistrationCodeStore} implementation.
 *
 * Shares the AUTH_KV_PATH file with the session and user stores. Same
 * write-through cache design: synchronous reads from an in-memory `Map`,
 * fire-and-forget KV writes for mutations. The cache is primed in `open()`.
 *
 * Defined in: server/src/core/auth/deno-kv-registration-code-store.ts
 * Consumers: Registered as `registrationCodeStore` in register-root-services.ts.
 */
export class DenoKvRegistrationCodeStore implements RegistrationCodeStore {
  // Write-through cache keyed by the code value.
  private readonly cache = new Map<string, RegistrationCode>();

  // Shared KV handle, injected by AuthKvProvider via open().
  private kv: Deno.Kv | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Primes the in-memory cache from KV.
   *
   * Unlike {@link DenoKvSessionStore.open} this does not filter by expiry at
   * load time — expired codes are still useful to expose via `list()` for
   * audit and are cleaned up periodically via `purgeExpired`.
   */
  public async open(pathOrKv: string | Deno.Kv): Promise<void> {
    this.kv = typeof pathOrKv === 'string' ? await Deno.openKv(pathOrKv) : pathOrKv;

    let loaded = 0;
    for await (const entry of this.kv.list<RegistrationCode>({ prefix: [KEY_PREFIX] })) {
      this.cache.set(entry.value.code, entry.value);
      loaded++;
    }
    this.loggerService.info(`[auth reg codes] loaded ${loaded} registration code(s) from KV store`);
  }

  public get(code: string): RegistrationCode | undefined {
    return this.cache.get(code);
  }

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
   * Atomically validates, increments, and persists the code row.
   *
   * Because the cache is the authoritative read source and single-threaded JS
   * prevents interleaving, the in-memory increment is effectively atomic. The
   * background KV write reflects the new state.
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

  public disable(code: string): void {
    const rec = this.cache.get(code);
    if (!rec || rec.disabled) return;
    rec.disabled = true;
    this.persist(rec);
  }

  public list(): ReadonlyArray<RegistrationCode> {
    return [...this.cache.values()];
  }

  public purgeExpired(nowMs: number): number {
    let removed = 0;
    for (const [code, rec] of this.cache) {
      if (rec.expiresAt !== null && rec.expiresAt <= nowMs) {
        this.cache.delete(code);
        this.kv?.delete([KEY_PREFIX, code]).catch((err: unknown) => {
          this.loggerService.warn(`[auth reg codes] purge delete failed for code ${code.slice(0, 6)}...: ${err}`);
        });
        removed++;
      }
    }
    return removed;
  }

  /**
   * Writes the current cached record to KV in the background.
   */
  private persist(rec: RegistrationCode): void {
    this.kv?.set([KEY_PREFIX, rec.code], rec).catch((err: unknown) => {
      this.loggerService.warn(`[auth reg codes] persist failed for code ${rec.code.slice(0, 6)}...: ${err}`);
    });
  }
}
