# Server Dependency Injection Conventions

This folder is the composition root for server runtime wiring.

## Lifetime Rules

- `root` lifetime:
  - App-wide singletons that live for the server process.
  - Register in `register-root-services.ts`.
  - Examples: `ServerConfigService`, `LoggerBackendProvider`, `ExpansionCatalogService`.

- `match` lifetime:
  - Services/state that must be isolated per active match.
  - Created inside `MatchScopeFactory`.
  - Examples: `MatchController`, `ReactionManager`, effect maps, `ActionService`.

- `transient` lifetime:
  - Short-lived stateful objects created per operation, not process-wide.
  - Construct through typed factories in `core` (not container APIs).
  - Example: `MatchConfiguratorFactory.create(...) -> MatchConfigurator`.

## Registration Boundaries

- Register app-wide services in `register-root-services.ts`.
- Register match-scoped services only in `MatchScopeFactory`.
- Keep Awilix container usage constrained to lifecycle wiring code (`composition/*`, `MatchScopeFactory`) and out of
  gameplay effect logic.

## Resolution Boundaries

- Top-level server startup uses `start-server.ts`.
- Match scope composition is performed by `MatchScopeFactory`.
- Avoid adding `container.resolve(...)` calls in feature code; prefer typed factories/services.

## Action Execution Path

- Effects and reactions should execute game actions through injected `ActionService`.
- `ScopedActionService` delegates to `MatchActionRunnerRef`, which is bound once to `MatchController.runGameAction(...)`
  when a match scope is created.
- This keeps action execution deterministic and removes per-call service-locator lookups.
