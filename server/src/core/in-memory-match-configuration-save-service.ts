import { MatchConfigurationSaveServiceBase } from './match-configuration-save-service-base.ts';

/**
 * In-memory implementation of {@link MatchConfigurationSaveStore}.
 *
 * All saves are held in the base class's cache; every persistence hook is a
 * no-op, so nothing is ever written to disk or any external store — saves
 * are lost on server restart.
 *
 * Used when `STORAGE_BACKEND=in-memory`.
 *
 * Defined in: server/src/core/in-memory-match-configuration-save-service.ts
 * Consumers: Registered as `matchConfigurationSaveService` in register-root-services.ts
 *   when STORAGE_BACKEND=in-memory.
 */
export class InMemoryMatchConfigurationSaveService extends MatchConfigurationSaveServiceBase {
  // Intentionally empty — every mutation hook inherited from the base class
  // is a no-op, which is exactly the desired in-memory behavior.
}
