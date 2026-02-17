# DI Architecture and Token Map

This document defines dependency-injection scope boundaries and token ownership for the server.

## Scope Model

- `server` scope:
  process lifetime (created in `server/src/server.ts`).
- `match` scope:
  one active match lifetime (created in `server/src/core/match-scope-factory.ts`).
- `match runtime` registrations:
  per-match runtime services registered into the same match scope by `server/src/core/match-runtime-factory.ts`.
- `match configurator` scope:
  short-lived scope per `MatchConfiguratorFactory.create(...)` call (created in `server/src/core/match-configurator-factory.ts`).

## Server Scope Tokens

Defined in `server/src/server.ts`:

| Token | Registration | Lifetime | Resolved By |
| --- | --- | --- | --- |
| `io` | `asValue(io)` | singleton | `Game`, socket wiring |
| `maxPlayers` | `asValue(6)` | singleton | `Game`, `PlayerRegistryService` |
| `matchScopeFactory` | `asClass(MatchScopeFactory)` | singleton | `Game` |
| `matchConfiguratorFactory` | `asClass(MatchConfiguratorFactory)` | singleton | `MatchScopeFactory`, `MatchController` |
| `expansionSearchService` | `asClass(ExpansionSearchService)` | singleton | `Game`, `MatchRuntimeFactory` |
| `expansionCompatibilityService` | `asClass(ExpansionCompatibilityService)` | singleton | `Game` |
| `matchRuntimeFactory` | `asClass(MatchRuntimeFactory)` | singleton | `MatchScopeFactory` |
| `matchSocketBindings` | `asClass(MatchSocketBindings)` | singleton | `MatchRuntimeFactory` |
| `configStore` | `asClass(FileGameConfigurationStore)` | singleton | `Game` |
| `lobbySocketBindings` | `asClass(LobbySocketBindings)` | singleton | `Game`, `MatchStartOrchestrator` |
| `disconnectedPlayerVoteService` | `asClass(DisconnectedPlayerVoteService)` | singleton | `Game` |
| `playerSessionService` | `asClass(PlayerSessionService)` | singleton | `Game` |
| `playerFactoryService` | `asClass(PlayerFactoryService)` | singleton | `Game`, `PlayerRegistryService` |
| `playerRegistryService` | `asClass(PlayerRegistryService)` | singleton | `Game` |
| `matchStartOrchestrator` | `asClass(MatchStartOrchestrator)` | singleton | `Game` |
| `serverStartupService` | `asClass(ServerStartupService)` | singleton | `server.ts` bootstrap |
| `game` | `asClass(Game)` | singleton | `server.ts` bootstrap |

## Match Scope Tokens

Defined in `server/src/core/match-scope-factory.ts`:

| Token | Registration | Lifetime | Resolved By |
| --- | --- | --- | --- |
| `socketMap` | `asValue(socketMap)` | match | `MatchController` |
| `matchConfiguratorFactory` | `asValue(this.matchConfiguratorFactory)` | match | `MatchController` |
| `match` | `asValue(createInitialMatchState())` | match | runtime services |
| `cardLibrary` | `asClass(MatchCardLibrary)` | match singleton | `MatchController`, setup/runtime |
| `cardSourceController` | `asClass(CardSourceController)` | match singleton | setup/runtime |
| `cardInstanceFactoryService` | `asClass(CardInstanceFactoryService)` | match singleton | setup/runtime/configuration events |
| `runtimeActionGateway` | `asClass(RuntimeActionGateway)` | match singleton | runtime services, `MatchScopeFactory` bind step |
| `endGamePolicyRegistryService` | `asClass(EndGamePolicyRegistryService)` | match singleton | `MatchController`, evaluator |
| `matchSetupService` | `asClass(MatchSetupService)` | match singleton | `MatchController` |
| `matchEndService` | `asClass(MatchEndService)` | match singleton | `MatchController` |
| `matchController` | `asClass(MatchController)` | match singleton | `MatchScopeFactory` |

## Match Runtime Registrations

Defined in `server/src/core/match-runtime-factory.ts`:

- Value tokens:
  `expansionSearchService`, `matchSocketBindings`,
  `cardEffectFunctionMap`, `eventEffectFunctionMap`, `projectEffectFunctionMap`,
  `boonEffectFunctionMap`, `hexEffectFunctionMap`, `stateEffectFunctionMap`,
  `artifactEffectFunctionMap`.
- Class tokens (all match singletons):
  `logManager`, `cardPriceController`, `findCardService`, `supplyGainService`,
  `buyOptionsResolver`, `reactionManager`, `endGameEvaluator`,
  `interactivityController`, `playerReconnectOrchestrator`, `gameActionsController`.

These are match-lifetime runtime services resolved directly by constructor injection (no `attachRuntime(...)` phase).

## Match Configurator Scope

Defined in `server/src/core/match-configurator-factory.ts`:

- `config` as value.
- `initContext` as value.
- `matchConfigurator` as class.

`MatchController.initialize(...)` creates this scope and resolves one configurator instance.

## Rules

- If a dependency needs process-wide data only, register it in `server` scope.
- If it depends on `match` state, `cardLibrary`, per-match registries, or per-match IDs, register it in `match` scope (including runtime registrations).
- Prefer constructor injection over passing ad-hoc service bundles.
- Avoid server singletons holding direct references to match-scoped instances.
- Keep token names stable and descriptive; token rename requires updating this document.

## Refactor Checklist

When converting a class to DI:

1. Choose scope (`server`, `match`, runtime registration in match scope, or short-lived factory scope).
2. Register token in the owning composition root.
3. Inject dependencies via constructor (do not manually `new` in callers).
4. Remove old utility/factory call sites if no longer needed.
5. Run `deno check --no-lock --config server/deno.json` on changed files.
6. Update this token map with new/removed tokens.
