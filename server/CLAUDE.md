# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See the parent `../CLAUDE.md` for full project architecture, game rules, coding standards, and constraints. This file covers server-specific details only.

## Build & Validation Commands

```bash
# Dev server with file watch (http + Socket.IO)
deno task dev:watch

# Type check
deno check --no-lock src/server.ts

# Lint
deno lint src/

# Format (uses oxfmt, not deno fmt)
deno task fmt

# Unit tests — only run when explicitly asked
deno task test:unit

# Unit tests with watch
deno task test:unit:watch

# Unit tests with coverage
deno task test:unit:coverage
```

Always use `--no-lock` for `deno check` and other deno commands that accept it — the deno bundled with Claude is not up to date.

## Import Aliases (deno.json)

- `@shared/` → `../shared/src/`
- `shared/types/` → `../shared/src/types/`
- `@server-types/` → `./src/type-groups/`
- `@expansions/` → `./src/expansions/`

## Source Layout

```
src/
├── server.ts              # Entry point: creates Awilix container, starts server
├── types.ts               # Core type definitions (GameActionDefinitionMap, 100+ actions)
├── composition/           # DI wiring: root services, scope factories, startup
├── core/                  # Game engine: controllers, services, managers
│   ├── actions/           # GameActionController — implements all game actions
│   ├── reactions/         # ReactionManager — triggered reactions and duration effects
│   ├── tokens/            # Token controllers and registries
│   ├── traits/            # Trait system
│   ├── ways/              # Way system
│   ├── events/            # Event system
│   ├── landmarks/         # Landmark system
│   ├── projects/          # Project system
│   ├── prophecies/        # Prophecy system
│   ├── allies/            # Ally system
│   └── __tests__/         # Unit tests
├── expansions/            # Per-expansion card defs, effects, configurators
├── type-groups/           # Re-exported type groupings (actions, effects, reactions, etc.)
├── testing/               # Test utilities (excluded from test runs)
├── utils/                 # Shared utilities
└── scripts/               # Dev scripts (export-match-state, run-browsers)
```

## DI Container (Awilix)

Uses `InjectionMode.CLASSIC` (constructor injection). Three scope levels:

| Scope | Factory/File | Lifetime | Examples |
|-------|-------------|----------|----------|
| Root | `composition/register-root-services.ts` | App process | ExpansionCatalogService, LoggerBackendProvider, socket gateway |
| Game | `core/game-scope-factory.ts` | Per lobby game | GameLobbySessionCoordinatorService, player sessions |
| Match | `core/match-scope-factory.ts` | Per active match | MatchController, ReactionManager, GameActionController, effect maps |

**Rules** (from `composition/README.md`):
- Keep Awilix container usage confined to composition code — use typed factories in feature code
- Effects and reactions execute actions through injected `ActionService`, not container lookups
- `ScopedActionService` delegates to `MatchActionRunnerRef`, bound once per match scope to `MatchController.runGameAction()`

## Action Pipeline

All game mutations flow through a single path:

```
MatchController.runGameAction()
  → structuredClone snapshot (top-level only, tracked by _actionDepth)
  → GameActionController.invokeAction(action, ...args)
    → action handler (method on controller or custom handler)
      → may call nested actionService.run() for sub-actions
  → fast-json-patch diff → broadcast patches via Socket.IO
```

Actions are defined in `GameActionDefinitionMap` in `types.ts`. Type groups in `src/type-groups/` provide organized re-exports: `actions.ts`, `context.ts`, `effects.ts`, `expansion.ts`, `lifecycle.ts`, `reactions.ts`.

## Expansion System

Each expansion lives under `src/expansions/<name>/` with this structure:

```
<name>/
├── card-library-<name>.json         # Card definitions (CardNoId format)
├── card-effects-<name>.ts           # CardExpansionModule: effect factories, lifecycle, scoring
├── configurator-<name>.ts           # ExpansionConfiguratorFactory: match-time config/reactions
├── configuration-<name>.json        # Expansion metadata (title, mutuallyExclusive, etc.)
├── token-definitions-<name>.ts      # Token definitions (if applicable)
├── token-<name>-ids.ts              # Token ID constants (if applicable)
└── types.ts                         # Expansion-specific types (if needed)
```

**CardExpansionModule pattern** (card-effects file):
```typescript
const expansion: CardExpansionModule = {
  cardKey: {
    registerEffects: () => (effectArgs) => { /* on-play effect */ },
    registerLifeCycleMethods?: (callbacks) => { /* onPlay, onGain, onCleanup, etc. */ },
    registerScoringFunction?: (match, player) => number,
  },
};
```

**ExpansionConfiguratorFactory pattern** (configurator file):
```typescript
const configurator: ExpansionConfiguratorFactory = () => {
  return async (args) => {
    // Modify config, register reactions, register effects, add game events
    return args.config;
  };
};
export default configurator;
```

Expansions are listed in `src/expansions/expansion-list.json` and loaded by `ExpansionLoaderService`.

## Effect & Reaction System

**Effect function signature:**
```typescript
type CardEffectFn = (context: CardEffectFunctionContext) => Promise<void>;
```

`CardEffectFunctionContext` provides: `actionService`, `match`, `playerId`, `cardLibrary`, `cardSourceController`, `reactionManager`, `loggerService`, and many other injected dependencies.

**Reaction registration** via `ReactionManager`:
```typescript
reactionManager.registerReactionTemplate({
  id: 'unique-id',
  listeningFor: 'onPlay',       // TriggerEventType
  playerId: player.id,          // optional: scope to player
  once: true,                   // optional: auto-remove after firing
  condition: async (ctx) => boolean,
  triggeredEffectFn: async (ctx) => { /* handler */ },
});
```

System reactions fire first, then per-player reactions in turn order.

**Duration effects** (`registerDurationEffect()`) associate trigger IDs with card IDs for cleanup when the card leaves play.

### Prompt buttons

Action button ids are arbitrary. A prompt's decline/cancel button MUST set
`role: 'cancel'` (conventional id: `PROMPT_DECLINE_ACTION` from
`shared/types`). The client uses this to decide dismissability: a prompt
with a cancel-role button can be dismissed (Escape/backdrop submits that
button's action), while a prompt without one is a required action the
player cannot dismiss. Never rely on `action === 0` alone to mean cancel
in new code.

**Lifecycle hooks** registered via `ExpansionCardMetadataRegistryService`: `onGameStartSetup`, `onGameStart`, `onCardGained`, `onGain`, `onPlay`, `onCleanup`.

## Logging

**LoggerService** is scoped with context metadata (`scope`, `gameId`, `matchScopeId`).

Log files:
- Server: `./logs/server.log`
- Game: `./logs/games/{gameId}/game.log`
- Match: `./logs/games/{gameId}/match/{matchId}/match.log`

## Formatting

Uses `oxfmt` (not `deno fmt`) configured in `.oxfmtrc.json`:
- `printWidth: 120`, `singleQuote: true`, `trailingComma: "all"`

The `deno.json` `fmt` section configures `deno fmt` as fallback with matching settings.

## Debug Endpoint

When running, current match state is available at: `http://192.168.0.149:3001/debug/match-state`
