---
name: match-state-integrity
description: Safeguard match state shape, patch generation, merge/import behavior, and serialization invariants for deterministic engine operation.
---

# Match State Integrity

Use this skill when changing match state structure, patch/snapshot flow, debug import/export, or schema-adjacent integrity checks.

## When To Use

Use for requests like:

- Add or modify fields on `Match` and related runtime state stores
- Update patch snapshot behavior and JSON patch emission logic
- Modify debug match export/merge endpoints
- Tighten validation around partial state merge/import flows

Do not use this skill for:

- Card effects (`expansion-effects-authoring`)
- Expansion setup decisions (`expansion-configurator-authoring`)
- Action semantics unless needed to preserve state invariants (`action-engine-authoring`)

## Primary Files

- `server/src/core/match-controller.ts`
- `server/src/core/game.ts`
- `server/src/server.ts`
- `shared/src/types/*`
- `server/src/types.ts`
- `server/*-library-schema.json`

## Inputs You Need

1. Exact state fields being added/changed and ownership of mutation points.
2. Expected patch visibility requirements for clients.
3. Merge/import safety constraints (allowed keys, anti-pollution rules).
4. Any transport/schema impact across shared/server types.

## Workflow

1. Identify authoritative state owner and initialization path.
2. Add/update types in shared/server type layers first.
3. Update initial match state construction and merge validation logic.
4. Ensure patch snapshots compare/emit in stable order and depth.
5. Preserve explicit mutation boundaries (actions/controllers only).
6. Update JSON schemas when model shape changes.
7. Run `deno check` for touched modules.

## Integrity Rules

- Reject unknown or dangerous merge keys by default.
- Keep partial merge behavior explicit and auditable.
- Maintain deterministic counters and IDs in state.
- Never bypass established state-transition layers for runtime changes.

## Interface Contract With Other Skills

- Consumes changes from `action-engine-authoring` and verifies they preserve state invariants.
- Must remain compatible with data shape produced by `expansion-configurator-authoring`.
- Must preserve reaction-related state semantics required by `reaction-lifecycle-authoring`.
- Provides stable state model used by `expansion-effects-authoring`.

## Validation Commands

```bash
deno check --no-lock --config server/deno.json server/src/core/match-controller.ts
deno check --no-lock --config server/deno.json server/src/core/game.ts
```

