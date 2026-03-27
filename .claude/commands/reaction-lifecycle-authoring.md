# Reaction Lifecycle Authoring

Implement and adjust reaction triggers, lifecycle callbacks, and resolution ordering with deterministic, rule-faithful behavior.

Use this skill when changing reaction evaluation, lifecycle hook timing, immunity/suppression behavior, or trigger cleanup.

## When To Use

Use for requests like:

- Add or update `registerReactionTemplate` usage patterns
- Change trigger ordering, once/compulsory semantics, or cleanup behavior
- Add/modify lifecycle events and their dispatch timing
- Fix reaction conflicts, loops, or duplicate trigger execution

Do not use this skill for:

- Card effect authoring (`/expansion-effects-authoring`)
- Match setup/configuration decisions (`/expansion-configurator-authoring`)
- Core action mutation logic (`/action-engine-authoring`)

## Required Companion Skills

- Always apply `/debug-logger` for implementation/refactor work done under this skill so logs are added or validated alongside reaction and lifecycle behavior changes.
- Always apply `/server-unit-testing` to write or update unit tests for new or changed reaction triggers, lifecycle callbacks, and resolution ordering logic.
- Apply `/debug-openapi-maintainer` whenever the task adds, removes, or changes any `/debug/*` route, `server/src/core/debug-openapi-spec.ts`, debug docs endpoints, or `server/docs/README-debug-api.md`. Do not ship debug-route behavior changes without matching OpenAPI/doc updates when `/debug-openapi-maintainer` conditions are met.
- Apply `/match-state-integrity` whenever changes add, modify, or remove reaction-related state on `Match` or related stores, affect patch generation for lifecycle events, or alter event/lifecycle serialization invariants.

## Primary Files

- `server/src/core/reactions/reaction-manager.ts`
- `server/src/core/reactions/build-action-map.ts`
- `server/src/core/reactions/build-action-buttons.ts`
- `server/src/core/reactions/group-reactions-by-card-key.ts`
- `server/src/core/card-lifecycle-map.ts`
- `server/src/type-groups/reactions.ts`

## Inputs You Need

1. Trigger event(s), owning card-like, and intended timing window.
2. Required ordering rules across players and reactions.
3. Whether immunity/suppression/once semantics apply.
4. Cleanup conditions (leave play, turn end, duration completion, etc.).

## Workflow

1. Locate current trigger and lifecycle paths in `ReactionManager`.
2. Model ordering across current player and targets using existing ordering helpers.
3. Implement template registration with stable IDs and explicit cleanup.
4. Ensure one-shot and optional/compulsory behavior matches card/rule text.
5. Keep reaction context isolated per trigger chain.
6. Add logs for registration, filtering decisions, execution, and unregistration per `/debug-logger` workflow.
7. If any debug route or debug API documentation surface was touched, invoke `/debug-openapi-maintainer` workflow and update behavior/spec/docs together.
8. If any reaction-related `Match` state fields, patch generation, or event serialization was changed, invoke `/match-state-integrity` workflow to validate state invariants.
9. Write or update unit tests per `/server-unit-testing` workflow for new or changed reaction and lifecycle logic.
10. Run `deno check` on touched modules.

## Determinism Rules

- Preserve stable player order when scanning reactions.
- Avoid non-deterministic queueing of simultaneous auto-reactions.
- Ensure trigger IDs are collision-safe for repeated plays/replays.
- Always unregister transient triggers when their scope ends.

## Interface Contract With Other Skills

- Receives action primitives from `/action-engine-authoring`; do not duplicate mutation logic.
- Provides trigger hooks consumed by `/expansion-effects-authoring`.
- Must honor setup assumptions from `/expansion-configurator-authoring`.
- Must keep event/lifecycle behavior compatible with `/match-state-integrity` patch expectations.

## Completion Checklist

- Reaction behavior matches rule text and ordering expectations.
- Trigger IDs are collision-safe and cleanup is explicit.
- `/debug-logger` companion requirements were satisfied.
- `/debug-openapi-maintainer` companion requirements were satisfied when debug API surfaces changed.
- `/match-state-integrity` companion requirements were satisfied when reaction-related state, patches, or serialization were affected.
- `/server-unit-testing` companion requirements were satisfied — unit tests cover new or changed reaction and lifecycle logic.
- All touched files pass `deno check`.

## Validation Commands

```bash
deno check --no-lock --config server/deno.json server/src/core/reactions/reaction-manager.ts
deno check --no-lock --config server/deno.json server/src/core/card-lifecycle-map.ts
```
