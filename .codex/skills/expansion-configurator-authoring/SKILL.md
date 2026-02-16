---
name: expansion-configurator-authoring
description: Implement and maintain expansion configurators that compute stable match setup, including add/remove symmetry for conditional configuration.
---

# Expansion Configurator Authoring

Use this skill when changing expansion setup logic that runs before gameplay starts or during configuration recomputation loops.

## When To Use

Use for requests like:

- Add/remove non-supply piles based on selected kingdom cards
- Seed/clear events, landmarks, projects, boons, hexes, states, artifacts
- Register expansion-scoped setup hooks from configurator modules
- Fix add/remove asymmetry in conditional configuration

Do not use this skill for:

- Card effect behavior during turns (`expansion-effects-authoring`)
- Core action handlers (`action-engine-authoring`)
- Reaction ordering semantics (`reaction-lifecycle-authoring`)

## Primary Files

- `server/src/core/match-configurator.ts`
- `server/src/expansions/*/configurator-*.ts`
- `server/src/expansions/expansion-library.ts`
- Expansion configuration JSON files under `server/src/expansions/*/`

## Inputs You Need

1. Triggering cards/card-likes and exact setup consequences.
2. Required removal behavior when trigger cards/card-likes are absent.
3. Expansion boundaries and cross-expansion interactions.
4. Constraints on randomizer selection and landscape caps.

## Workflow

1. Confirm setup rule text and nearest configurator pattern.
2. Implement both addition and removal branches in the same change.
3. Preserve dedupe behavior (`uniqueByProp`) and pile-key semantics.
4. Keep configuration iteration idempotent across multiple passes.
5. Avoid leaking runtime turn logic into configurators.
6. Log why setup entries are added, retained, or removed.
7. Run `deno check` on touched configurator and config files.

## Stability Rules

- If a card/card-like enables config, remove that config when no longer enabled.
- Keep configurator output stable across repeated recomputation loops.
- Do not introduce expansion-order-sensitive side effects unless required.
- Prefer structural dedupe by `cardKey`/randomizer rather than object identity.

## Interface Contract With Other Skills

- Produces computed config consumed by `action-engine-authoring` and `expansion-effects-authoring`.
- Must not own runtime reaction execution (belongs to `reaction-lifecycle-authoring`).
- Must keep configured state compatible with serialization/merge expectations from `match-state-integrity`.

## Validation Commands

```bash
deno check --no-lock --config server/deno.json server/src/core/match-configurator.ts
deno check --no-lock --config server/deno.json server/src/expansions/<expansion>/configurator-<expansion>.ts
```

