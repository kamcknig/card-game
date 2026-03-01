# Action Engine Authoring

Implement and update core game actions, deterministic state transitions, and action-level invariants in the server engine.

Use this skill when changing core action handlers or adding new engine actions that mutate match state.

## When To Use

Use for requests like:

- Add or modify `runGameAction` handlers
- Add action typing to `GameActionDefinitionMap`
- Enforce deterministic mutation and action invariants
- Refactor action logic without changing card rules meaning

Do not use this skill for:

- Writing expansion card effects (`/expansion-effects-authoring` handles that)
- Expansion setup/config toggles (`/expansion-configurator-authoring`)
- Reaction ordering and lifecycle trigger policies (`/reaction-lifecycle-authoring`)

## Required Companion Skills

- Always apply `/debug-logger` for implementation/refactor work done under this skill so logs are added or validated alongside behavior changes.
- Apply `/debug-openapi-maintainer` whenever the task adds, removes, or changes any `/debug/*` route, `server/src/core/debug-openapi-spec.ts`, debug docs endpoints, or `server/docs/README-debug-api.md`. Do not ship debug-route behavior changes without matching OpenAPI/doc updates when `/debug-openapi-maintainer` conditions are met.
- Apply `/match-state-integrity` whenever changes add, modify, or remove fields on `Match` or related runtime state stores, affect patch generation or snapshot behavior, or alter action-level state invariants.

## Primary Files

- `server/src/core/actions/game-action-controller.ts`
- `server/src/core/actions/resolve-buy-options.ts`
- `server/src/core/actions/card-action-condition-map-factory.ts`
- `server/src/core/actions/card-alternate-buy-option-map-factory.ts`
- `server/src/types.ts`

## Inputs You Need

1. Exact action behavior and edge-case expectations.
2. Whether new action state fields are required on `Match`.
3. Lifecycle/reaction expectations (if any) to coordinate with reaction skill.
4. Any Dominion rule citations that constrain timing or legality.

## Workflow

1. Identify the nearest existing action pattern in `game-action-controller.ts`.
2. Add or update `GameActionDefinitionMap` typing first.
3. Implement the action with explicit state transitions and early returns.
4. Keep lifecycle trigger invocation explicit and localized.
5. Keep prompts/selection paths deterministic and validated.
6. Add log/info/debug statements for branch decisions and state deltas per `/debug-logger` workflow.
7. Verify no hidden mutation bypasses approved controllers.
8. If any debug route or debug API documentation surface was touched, invoke `/debug-openapi-maintainer` workflow and update behavior/spec/docs together.
9. If any `Match` state fields, patch generation, or serialization behavior was changed, invoke `/match-state-integrity` workflow to validate state invariants.
10. Run `deno check` on touched files.

## Determinism Rules

- Never rely on object key iteration order for gameplay decisions.
- Preserve stable ordering for target selection and action resolution.
- Keep monotonic counters monotonic and match-scoped.
- Fail fast on invalid action inputs instead of silently recovering.

## Interface Contract With Other Skills

- Consumes configuration prepared by `/expansion-configurator-authoring`.
- Exposes stable primitives used by `/expansion-effects-authoring`.
- Must not encode reaction policy that belongs to `/reaction-lifecycle-authoring`.
- Must preserve patch/serialization assumptions validated by `/match-state-integrity`.

## Completion Checklist

- Action behavior matches specification and edge-case expectations.
- State transitions are explicit, deterministic, and traceable.
- `/debug-logger` companion requirements were satisfied.
- `/debug-openapi-maintainer` companion requirements were satisfied when debug API surfaces changed.
- `/match-state-integrity` companion requirements were satisfied when state shape, patches, or serialization were affected.
- All touched files pass `deno check`.

## Validation Commands

```bash
deno check --no-lock --config server/deno.json server/src/core/actions/game-action-controller.ts
deno check --no-lock --config server/deno.json server/src/types.ts
```
