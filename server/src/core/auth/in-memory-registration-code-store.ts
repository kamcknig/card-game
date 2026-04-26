import type { RegistrationCode, RegistrationCodeStore } from './registration-code-store.ts';

/**
 * Hex code length matching {@link DenoKvRegistrationCodeStore}. 128 bits.
 */
const CODE_LENGTH_HEX = 32;

/**
 * Random hex code generator shared with the KV store for consistency.
 */
const generateCode = (): string => {
  const bytes = new Uint8Array(CODE_LENGTH_HEX / 2);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * In-memory {@link RegistrationCodeStore} used by tests only — production
 * composition selects DenoKvRegistrationCodeStore or SupabaseRegistrationCodeStore
 * via STORAGE_BACKEND.
 *
 * Identical semantics to {@link DenoKvRegistrationCodeStore} without any disk
 * persistence. All methods are synchronous and backed by a plain Map.
 */
export class InMemoryRegistrationCodeStore implements RegistrationCodeStore {
  private readonly cache = new Map<string, RegistrationCode>();

  public get(code: string): RegistrationCode | undefined {
    return this.cache.get(code);
  }

  public create(args: {
    createdBy: string;
    expiresAt: number | null;
    maxUses: number;
    now: number;
  }): RegistrationCode {
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
    return rec;
  }

  public recordUse(code: string, nowMs: number): RegistrationCode | undefined {
    const rec = this.cache.get(code);
    if (!rec) return undefined;
    if (rec.disabled) return undefined;
    if (rec.expiresAt !== null && rec.expiresAt <= nowMs) return undefined;
    if (rec.usedCount >= rec.maxUses) return undefined;

    rec.usedCount++;
    if (rec.usedCount >= rec.maxUses) {
      rec.disabled = true;
    }
    return rec;
  }

  public disable(code: string): void {
    const rec = this.cache.get(code);
    if (!rec) return;
    rec.disabled = true;
  }

  public list(): ReadonlyArray<RegistrationCode> {
    return [...this.cache.values()];
  }

  public purgeExpired(nowMs: number): number {
    let removed = 0;
    for (const [code, rec] of this.cache) {
      if (rec.expiresAt !== null && rec.expiresAt <= nowMs) {
        this.cache.delete(code);
        removed++;
      }
    }
    return removed;
  }
}
