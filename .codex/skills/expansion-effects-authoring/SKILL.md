---
name: expansion-effects-authoring
description: Implement and update Dominion expansion card and card-like effects (cards, events, projects, landmarks, artifacts, boons, hexes, states) with deterministic behavior, correct trigger ordering, stable match configuration changes, and codebase conventions.
---

# Expansion Effects Authoring

Use this skill when implementing or updating expansion mechanics in this codebase.

## When To Use

Use for requests like:

- Implement card effects from `dominion-docs/expansion-docs/...`
- Implement card-like effects (event/project/landmark/artifact/boon/hex/state)
- Add or update expansion setup/configuration caused by cards/card-likes
- Fix rule interactions, trigger ordering, or lifecycle behavior

## Inputs You Need

Collect these first:

1. Exact docs path(s) for the mechanic being implemented.
2. Expansion/module target file(s) in `server/src/expansions/...`.
3. Any utility constraints or preferences from the requester (optional).
4. Whether AI support is required now or deferred.

## Implementation Workflow

1. Read docs and FAQ first.
2. Identify mechanic shape:
   - Card effect (`card-effects-*.ts`)
   - Card-like effect (`event-effects-*`, `project-effects-*`, etc.)
   - Match setup/configurator updates (`configurator-*.ts`)
3. Discover reusable helpers/utilities in the codebase:
   - Search in `server/src/utils` and expansion-local helpers first.
   - Prefer existing shared helpers before adding new ones.
4. Locate nearest existing pattern in same expansion first, then adjacent expansions.
5. Implement with existing abstractions:
   - `runGameActionDelegate(...)`
   - `registerEffects`, `registerLifeCycleMethods`
   - `reactionManager.registerReactionTemplate/registerSystemTemplate`
   - price/token/state controllers
6. Add/update metadata typing (no unsafe casts):
   - Prefer generic typed accessors (`getCard<T>`, typed card-like match finders).
7. Add/update configuration side effects:
   - If a card/card-like adds config (mat/non-supply/token/source), ensure removal logic is also stable when the source is absent.
8. Add debug/info/log messages that explain:
   - decision branches
   - skipped branches
   - selected cards/targets
   - registration/unregistration points
9. Validate with `deno check` on touched files.

## Hard Rules

- Preserve determinism.
- Follow existing architecture; do not bypass action/reaction pipelines.
- No hidden state mutation outside approved controllers/actions.
- Do not add custom reaction ids unless necessary.
- Follow Lose Track and Stop-Moving rules.
- Prefer pile-key semantics over card-key semantics for supply-top effects (split pile safe).
- Keep comments for all new code.
- Do not remove pre-existing comments.

## Effect Authoring Conventions

- Prefer early returns over nesting.
- Use single quotes for strings where possible.
- Prefer shared helpers over local duplicate logic.
- For gain-from-supply helpers, include useful `logTag` and debug context.
- Use per-player/per-turn tracking where rules require it; avoid global flags unless rule is truly global.

## Card-Like Metadata Typing

When reading/writing metadata on events/landmarks/projects/artifacts/boons/hexes/states:

- Use typed match finder generics (for example `findEventInMatch<MyMetadata>(...)`).
- Do not cast with `as ...Metadata` unless no typed path is available.
- If typed path is missing, add a generic helper once and migrate callers.

## Logging Standard

- `log`: high-level action.
- `info`: why a branch/decision is happening.
- `debug`: low-level state and branch details.
- Use `warn`/`error` for unexpected states or failed assumptions.

## Validation Commands

Run targeted checks for changed files:

```bash
deno check --no-lock --config server/deno.json server/src/expansions/<expansion>/<file>.ts
deno check --no-lock --config server/deno.json shared/src/<shared-file>.ts
deno check --no-lock --config server/deno.json server/src/server.ts
```

When changing multiple files, check each touched module file directly.

## Completion Checklist

- Behavior matches docs + FAQ text.
- Trigger timing/ordering matches engine conventions.
- Metadata is typed, not cast.
- Config additions/removals remain stable.
- Logs and comments are sufficient for debugging.
- All touched files pass `deno check`.
