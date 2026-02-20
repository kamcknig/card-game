---
name: debug-logger
description: Add, enhance, and standardize server-side logging for this Dominion game engine. Use when requests include phrases like "add logging for", "enhance logging for", or "add logging to", and when implementing or refactoring flows that need traceable deterministic logs.
---

# Debug Logger

## Objective

Implement deterministic, context-rich, production-grade logging for server code paths.

## Workflow

1. Identify the exact code path to instrument.
2. Map key transitions: entry, branching decisions, state mutations, external calls, and failure paths.
3. Reuse existing `LoggerService` injection when present; otherwise, add constructor injection using existing project patterns.
4. Add logs at the right granularity and level.
5. Keep log payloads stable and compact so runs are easy to diff and trace.
6. Verify no gameplay behavior changes; logging must be observational only.

## Log Level Rules

Use these levels consistently:

- `log`: high-level system action.
- `info`: rationale and important decisions. might contain key variables to
  identify specific flows for items.
- `debug`: low-level execution details and values used to diagnose issues.
  includes almost all variables relevant at that point in time.
- `warn`: recoverable anomalies or unexpected-but-handled states.
- `error`: failures or exceptions; include the error object.

## Placement Rules

- Log one clear start marker for complex actions or handlers.
- Log decision points that affect flow or resulting state.
- Log before and after critical state transitions when debugging value is high.
- Log recoverable edge cases with enough context to diagnose quickly.
- Avoid noisy per-iteration logs unless the request explicitly asks for deep tracing.
- Avoid duplicate messages at multiple layers for the same event.

## Message and Context Rules

- Prefer structured context keys via logger context methods over long free-form strings.
- Use stable key names and ordering in messages/context.
- Keep messages concise and specific to the action.
- Avoid logging secrets or unnecessary large payloads.
- Include identifiers like player, card, phase, or match scope when relevant.

## Implementation Rules

- Prefer `LoggerService` methods (`log`, `info`, `debug`, `warn`, `error`) over direct `console.*` in server code.
- Use `logWithContext`/`infoWithContext`/`debugWithContext`/`warnWithContext`/`errorWithContext` when adding one-off fields.
- Preserve existing comments; update comments only when behavior changes.
- Add comments for newly written code when behavior is not obvious.
- Do not add tests unless explicitly requested.

## Resources

Use these bundled server assets as canonical logging references:

- `assets/server/src/core/logger-service.ts`: core logger API, level methods, context prefix behavior, and file write/rotation logic.
- `assets/server/src/core/server-config-service.ts`: logging-related environment config (`LOG_TO_FILE`, `LOG_FILE_MAX_BYTES`).
- `assets/server/src/core/game-data-paths.ts`: server/game/match log directory path conventions.
- `assets/server/src/composition/register-root-services.ts`: root DI registration for logger backend/provider/context.
- `assets/server/src/core/game-scope-factory.ts`: game-scope `loggerContext` registration pattern.
- `assets/server/src/core/match-scope-factory.ts`: match-scope `loggerContext` registration pattern.
