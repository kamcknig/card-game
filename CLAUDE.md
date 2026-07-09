# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See <https://wiki.dominionstrategy.com/index.php/Main_Page> for Dominion rules,
setup, expansions, and clarifications.

# Project Structure & Module Organization

This repository is a small monorepo with three main packages:
- `server/`: Deno TypeScript game server (`src/core`, `src/expansions`, `src/utils`, `scripts/`). See `server/CLAUDE.md` for server-specific architecture.
- `angular-frontend/`: Angular 19 client (`src/app`, `src/environments`, `public/assets`). See `angular-frontend/CLAUDE.md` for frontend-specific architecture.
- `shared/`: shared TypeScript utilities/types used by server and client.

Top-level files like `docker-compose.dev.yml`, `docker-compose.prod.yml`, and `GAME_SUMMARY.md` support local orchestration and game/domain context. Production Dockerfiles live in `docker/`. CI/CD workflows live in `.github/workflows/`.

## Shared Package

Pure TypeScript types and utilities consumed directly (no build step) by both
server and client. Core file: `shared/src/shared-types.ts`. Types re-exported
via `shared/src/types/index.ts` organized by domain (primitives, card, match,
network, prompts, filters, etc.). Utilities include `find-card-like-in-match`,
`compare-card-cost`, `get-player-position-utils`, `validate-cost-spec`.

Import paths:
- Frontend: tsconfig path `shared/*` → `../shared/src/*`
- Server: deno.json alias `@shared/` → `../shared/src/`, `shared/types/` → `../shared/src/types/`

# Objective

Maintain a stable, extensible, and mechanically sound game engine that scales
without breaking under rule interactions.

## Priority Order

When rules conflict, use this order:

1. Correctness and determinism
2. Existing architecture and invariants
3. Rule fidelity (including clarifications)
4. Extensibility and maintainability
5. Performance

## Core Responsibilities

- Implement mechanics exactly as specified by docs and existing systems
- Extend systems without breaking implicit contracts
- Preserve determinism across players, turns, and simulations
- Prefer established patterns over introducing new ones
- Keep match configurations stable:
  - If configuration is added due to a card and that card is removed, remove the
    added configuration too

## Scope

### In Scope

- Server game engine logic (turn flow, phases, actions, effects)
- Angular frontend game UI logic
- Card/unit/ability definitions
- Effect pipelines, triggers, reactions, and resolution ordering
- State mutation, patch generation, and reconciliation
- AI logic constrained by the same rules as human players
- Serialization/deserialization of match state
- Keeping JSON schemas up to date with JSON model changes

#### API

- creating api endpoints for new features for debug purposes
- follow restful principles.

### Code commits

- NEVER mention AI use without explicit permission.
- NEVER commit without explicit approval.

### Out of Scope

- Asset creation (art, sound, animation)
- Marketing copy or flavor text unless requested
- Refactors not justified by correctness/extensibility
- Removing commented code unless requested
- Whitespace-only edits
- Backwards compatibility by default (alpha software)

## Architectural Constraints

- Follow existing abstractions
- Use injection principles where possible; avoid new'ing instances manually.
  - prefer class injection over proxy inject, and include accessors in
    constructors
- Keep state changes explicit and traceable
- No hidden side effects
- No mutation outside approved state-transition layers
- When introducing new classes/variables/etc, also document where they are
  defined and how consumers obtain them
- Do not add custom reaction registration ids unless necessary
- Follow Dominion `Lose Track` rule:
  - <https://wiki.dominionstrategy.com/index.php/Lose_Track_rule>
- Follow Dominion `Stop-Moving` rule:
  - <https://wiki.dominionstrategy.com/index.php/Stop-Moving_rule>

## Coding Standards

- Prefer explicitness over cleverness
- Favor pure functions when practical
- Type safety is required; avoid unsafe casts
- Avoid duplicate logic across handlers/effects
- Never remove existing comments; update them when behavior changes
- Add comments for all newly written code
- Add logging for debugging and traceability
- Prefer single quotes for strings (template literals are fine when needed)
- Follow established code style and logic patterns in the project
- Keep JSON schema validation correct for all JSON model changes
- Only include `cardName` in card library entries when needed
- Prefer early returns over deep nesting
- Prefer `++` over `+= 1` when appropriate
- Follow `.editorconfig`: 2-space indentation, trim trailing whitespace, final newline
- TypeScript filenames use kebab-case (examples: `match-controller.ts`, `card-effects-intrigue.ts`)
- Keep expansion assets/config grouped under `server/src/expansions/<expansion-name>/`

## Reasoning Model

- Assume adversarial edge cases
- Simulate full turn and multi-turn interactions before coding
- Treat mechanics as composable with all other mechanics
- Optimize in this order: correctness, then performance, then convenience

## Logging Standards

Use consistent levels and meaningful context:

- `log`: high-level system action
- `info`: rationale/decision context
- `debug`: low-level state and execution details
- Use `warn` and `error` where appropriate

## Documentation Locations

- Expansion docs: `dominion-docs/expansion-docs`
- Each expansion has a `README.md` with mechanics and links to card/event/etc
  docs
- CI/CD pipeline, production architecture, secrets: [`docs/development.md`](docs/development.md#cicd-pipeline)
- Unraid operations (containers, env vars, rollback, troubleshooting): [`docs/unraid-operations.md`](docs/unraid-operations.md)
- Debug API (endpoints, auth, interactive docs): [`server/README.md`](server/README.md#debug-api)
- Frontend design guidelines (tokens, typography, theming, component patterns): [`docs/design-guidelines.md`](docs/design-guidelines.md)
- Dockerfiles: `docker/` (production and dev images)
- GitHub Actions workflows: `.github/workflows/`

# Build, Test, and Development Commands

Install dependencies in each package before running:
- `npm install` (root), `cd server && npm install`, `cd angular-frontend && yarn install` (angular-frontend uses yarn).

Key commands:
- `npm run watch` (from root): run both server and frontend concurrently.
- `cd server && deno task dev:watch`: run server with file watch (http://localhost:3001).
- `cd angular-frontend && npm run start`: run Angular dev server (http://localhost:51455, proxies `/socket.io` and `/debug` to server).
- `cd server && deno check --no-lock src/server.ts`: type-check server.
- `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit`: type-check frontend (preferred routine validation).
- `cd angular-frontend && npm run build`: production client build (optional for routine frontend code validation).
- `cd angular-frontend && npm test`: run unit tests (Karma/Jasmine).
- `cd server && deno lint src/`: lint server TypeScript.
- `cd server && deno task fmt`: format server code with oxfmt.
- `cd server && deno task test:unit`: run server unit tests.

## CI/CD and Deployment

See [`docs/development.md`](docs/development.md#cicd-pipeline) for CI/CD pipeline details, GitHub Actions workflows, and production architecture. See [`docs/unraid-operations.md`](docs/unraid-operations.md) for day-to-day Unraid operations (updating containers, secrets, rollback, troubleshooting). Deployment is manual — CI builds and publishes release images to GHCR; there is no automatic deploy step.

## Tooling Rules

- Do not use `deno run` for long-running tasks without permission
- Other Deno tasks are allowed when they produce expected bounded output
- Use `deno check` for type checking (not `deno run --check`)
- Use `--no-lock` for relevant deno commands because the deno bundled with claude is not up to date

## Testing Guidelines

- Frontend unit tests live next to source as `*.spec.ts` under `angular-frontend/src/app/**`.
- Use `npm test` in `angular-frontend` for local verification.
- For routine code changes, do not start the frontend or backend apps just to validate changes; type checking is sufficient.
- For frontend changes, required validation is TypeScript checking only: `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit`.
- Do not require `npm run build`/`ng build` for routine frontend changes.
- Server currently has lint/task-based validation but no established unit test suite; add targeted tests with new frontend behavior and regression-prone logic.
- No mandatory testing policy currently defined.

## Debugging Resources

If the server is running, current match state is available at:

- <http://192.168.0.149:3001/debug/match-state>

## Communication Rules

- Respond with concrete implementations or diffs, not only descriptions
- State assumptions explicitly when unavoidable
- Do not ask questions unless missing information blocks correctness
- Do not simplify game rules in ways that change meaning

## Documentation Expectations

- All code should be documented. Methods should be commented with a summary
  and a description of their behavior.
- Log entries should be added appropriately for all code changes including
  all appropriate levels to show different levels of verbosity for debugging.
- Readme files and other documentation files should be updated appropriately
  with new features or updates to existing features and architecture.

## Commit & Pull Request Guidelines

Recent commits use short, imperative, lowercase summaries (examples: `added raid event`, `inheritance completed`). Keep subject lines concise and feature-scoped.

For pull requests:
- Explain gameplay/logic impact and touched areas (`server`, `angular-frontend`, `shared`).
- Link related issue(s) when available.
- Include screenshots/GIFs for UI changes and reproduction steps for bug fixes.
- List commands run locally (build, tests, lint) before requesting review.

## Failure Conditions

The agent has failed if it:

- Introduces non-deterministic behavior
- Breaks existing mechanics
- Circumvents established systems
- Leaks UI/transport concerns into core game logic
- Produces example-grade code instead of production-grade logic
