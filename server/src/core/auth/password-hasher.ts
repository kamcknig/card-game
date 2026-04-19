import { compare as bcryptCompare, hash as bcryptHash } from 'bcrypt';
import Argon2id from '@rabbit-company/argon2id';

/**
 * Supported password hash algorithms tracked on UserRecord.passwordAlgo.
 *
 * All new hashes use argon2id. Existing bcrypt hashes continue to verify and
 * are rehashed to argon2id on next successful login (see
 * UserAccountAuthProvider.authenticate).
 */
export type PasswordAlgo = 'argon2id' | 'bcrypt';

/**
 * Contract for pluggable password hashers.
 *
 * Each hasher wraps one algorithm. `hash()` produces an encoded string that
 * contains the algorithm parameters and salt; `verify()` is self-describing
 * given that encoded form. The `algo` field is used to select the appropriate
 * verifier at login time based on UserRecord.passwordAlgo.
 *
 * Defined in: server/src/core/auth/password-hasher.ts
 * Consumers: UserAccountAuthProvider, user-creation CLI, password-change route.
 */
export interface PasswordHasher {
  readonly algo: PasswordAlgo;

  /**
   * Produces an encoded hash string for the given plaintext password.
   *
   * The encoded form includes the algorithm parameters and a random salt so
   * that `verify()` does not require any additional state.
   */
  hash(plain: string): Promise<string>;

  /**
   * Returns true when the plaintext password matches the encoded hash.
   *
   * Must run in ~constant time regardless of mismatch location; both
   * argon2id and bcrypt implementations satisfy this.
   */
  verify(plain: string, encoded: string): Promise<boolean>;
}

/**
 * Argon2id hasher backed by `@rabbit-company/argon2id`.
 *
 * All new user passwords are hashed with this implementation. The underlying
 * library uses WASM-compiled Argon2id with sensible defaults (parallelism=4,
 * memory=16 MiB, iterations=3, length=32 bytes) and generates random salts
 * automatically inside `hashEncoded`.
 *
 * Lifetime: Root singleton — stateless, so safe to share.
 * Consumers: UserAccountAuthProvider, ServerAuthRouteHandlerService (password
 *   change), and the auth-create-user CLI script.
 */
export class Argon2idHasher implements PasswordHasher {
  readonly algo: PasswordAlgo = 'argon2id';

  /**
   * Hashes the plaintext with a fresh random salt and returns the PHC-encoded
   * string, e.g. `$argon2id$v=19$m=65536,t=3,p=4$...`.
   */
  public hash(plain: string): Promise<string> {
    // hashEncoded(message, salt?, parallelism?, memory?, iterations?, length?)
    // Passing a fresh salt via randomSalt() keeps per-password entropy high.
    return Argon2id.hashEncoded(plain, Argon2id.randomSalt());
  }

  /**
   * Verifies plaintext against a previously produced Argon2id encoded hash.
   *
   * Returns false (rather than throwing) when the encoded string is malformed
   * so that a corrupted hash cannot accidentally authenticate or crash the
   * login path.
   */
  public async verify(plain: string, encoded: string): Promise<boolean> {
    try {
      return await Argon2id.verify(encoded, plain);
    } catch {
      return false;
    }
  }
}

/**
 * Bcrypt hasher backed by `https://deno.land/x/bcrypt`.
 *
 * Used only for *verification* of legacy bcrypt hashes. New hashes are never
 * produced with bcrypt —
 * the `hash()` method remains available for completeness (and for tests) but
 * should not be called from production code paths. On successful login with
 * a bcrypt hash, UserAccountAuthProvider rehashes the plaintext with
 * Argon2idHasher and persists the new algorithm.
 *
 * Lifetime: Root singleton.
 */
export class BcryptHasher implements PasswordHasher {
  readonly algo: PasswordAlgo = 'bcrypt';

  /**
   * Hashes plaintext with bcrypt using a generated salt.
   *
   * Retained primarily for tests and migration tooling; production code
   * should use {@link Argon2idHasher} for all new hashes.
   */
  public hash(plain: string): Promise<string> {
    return bcryptHash(plain);
  }

  /**
   * Verifies plaintext against a bcrypt encoded hash.
   *
   * Returns false on verification failure or when the encoded string is
   * malformed.
   */
  public async verify(plain: string, encoded: string): Promise<boolean> {
    try {
      return await bcryptCompare(plain, encoded);
    } catch {
      return false;
    }
  }
}
