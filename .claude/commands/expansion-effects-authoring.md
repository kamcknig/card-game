# Expansion Effects Authoring

Implement or update Dominion expansion card and card-like effects (cards, events, projects, landmarks, artifacts, boons, hexes, states) with deterministic behavior, correct trigger ordering, stable setup/configuration changes, and codebase conventions. Use when requests mention `dominion-docs/expansion-docs/...`, implementing expansion mechanics, fixing rule interactions, or correcting lifecycle/ordering behavior.

## Required Companion Skills

- Always apply `/debug-logger` for implementation/refactor work done under this skill so logs are added or validated alongside behavior changes.
- Always apply `/server-unit-testing` to write or update unit tests for new or changed card/card-like effect logic. Tests should cover effect branches, edge cases, and interaction with shared utilities.
- Apply `/debug-openapi-maintainer` whenever the task adds, removes, or changes any `/debug/*` route, `server/src/core/debug-openapi-spec.ts`, debug docs endpoints, or `server/docs/README-debug-api.md`.
- Do not ship debug-route behavior changes without matching OpenAPI/doc updates when `/debug-openapi-maintainer` conditions are met.
- Apply `/match-state-integrity` whenever changes add, modify, or remove fields on `Match` or related runtime state stores, affect patch generation or snapshot behavior, or alter serialization/merge/import invariants.

## Inputs You Need

1. Exact docs path(s) for the mechanic being implemented.
2. Expansion/module target file(s) in `server/src/expansions/...`.
3. Any utility constraints or preferences from the requester (optional).
4. Whether AI support is required now or deferred.
5. Existing utility candidates already known by the requester (optional).

## Implementation Workflow

1. Read docs and FAQ first.
2. Identify mechanic shape:
   - Card effect (`card-effects-*.ts`)
   - Card-like effect (`event-effects-*`, `project-effects-*`, etc.)
   - Match setup/configurator updates (`configurator-*.ts`)
3. Discover reusable helpers/utilities in the codebase:
   - Search `server/src/utils`, `server/src/core`, and `shared/src` before writing helper logic.
   - Search expansion-local helpers in the same expansion directory.
   - Reuse an existing helper when behavior is equivalent or near-equivalent.
   - If behavior is near-equivalent, extend the shared helper instead of creating a duplicate local helper.
4. Locate nearest existing pattern in same expansion first, then adjacent expansions.
5. Implement with existing abstractions:
   - `registerEffects`, `registerLifeCycleMethods`
   - `reactionManager.registerReactionTemplate/registerSystemTemplate`
   - Prefer framework-generated reaction IDs; only provide manual `id` values when required for explicit lifecycle cleanup or deterministic multi-instance disambiguation.
   - `registerDurationEffect(...)`
   - action service and price/token/state controllers
6. Add/update metadata typing:
   - Prefer generic typed accessors (`getCard<T>`, typed card-like match finders).
   - Avoid unsafe casts when a typed path is available.
7. Add/update configuration side effects:
   - If a card/card-like adds config (mat/non-supply/token/source), ensure removal logic is stable when the source is absent.
8. Add debug/info/log messages that explain:
   - decision branches
   - skipped branches
   - selected cards/targets
   - registration/unregistration points
9. If any debug route or debug API documentation surface was touched, invoke `/debug-openapi-maintainer` workflow and update behavior/spec/docs together.
10. If any `Match` state fields, patch generation, or serialization behavior was changed, invoke `/match-state-integrity` workflow to validate state invariants.
11. Write or update unit tests per `/server-unit-testing` workflow for new or changed effect logic and any new shared utilities.
12. Validate with `deno check` on touched files.

## Shared Utility Reuse Gate

Before introducing any new helper function, apply this gate in order:

1. Confirm no existing utility already provides the behavior (`server/src/utils`, `server/src/core`, `shared/src`, and expansion-local helpers).
2. If a close helper exists, modify or generalize that helper and reuse it.
3. Add a new helper only when behavior is genuinely new and cannot be expressed safely by existing utilities.
4. Place reusable helpers in shared locations (`server/src/utils` or `shared/src`) rather than file-local scope.
5. Keep local helpers only when they are intentionally one-off and not suitable for cross-module reuse.

## Hard Rules

- Preserve determinism.
- Follow existing architecture; do not bypass action/reaction pipelines.
- No hidden state mutation outside approved controllers/actions.
- Do not create reaction/trigger IDs manually unless absolutely necessary.
- Follow Dominion Lose Track and Stop-Moving rules.
- NEVER use `select*` actions (`selectSingleCard`, `selectCard`, etc.) when the player would be unable to see the candidate cards on the board (for example, cards currently in deck/hidden zones).
- In hidden/invisible-card cases, use a prompt-based action (`userPrompt` / `promptService`) that explicitly displays the candidate cards and choice UI.
- Prefer pile-key semantics over card-key semantics for supply-top effects (split pile safe).
- Keep comments for all new code.
- Do not remove pre-existing comments.
- Do not create new local helpers that duplicate existing shared behavior.

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
```

When changing multiple files, run checks for each touched module file directly.

## Completion Checklist

- Behavior matches docs + FAQ text.
- Trigger timing/ordering matches engine conventions.
- Metadata is typed, not cast.
- Config additions/removals remain stable.
- Logs and comments are sufficient for debugging.
- `/debug-logger` companion requirements were satisfied.
- `/debug-openapi-maintainer` companion requirements were satisfied when debug API surfaces changed.
- `/match-state-integrity` companion requirements were satisfied when state shape, patches, or serialization were affected.
- `/server-unit-testing` companion requirements were satisfied — unit tests cover new or changed effect logic and shared utilities.
- All touched files pass `deno check`.
- Shared utility reuse was evaluated first, and no duplicate local helper behavior was introduced.
