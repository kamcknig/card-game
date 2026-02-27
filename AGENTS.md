<<<<<<< Updated upstream
See `GAME_SUMMARY.md` for a high-level overview of the project.

See <https://wiki.dominionstrategy.com/index.php/Main_Page> for Dominion rules,
setup, expansions, and clarifications.

# AGENTS.md

This file defines behavior, scope, and constraints for the Game Development
Agent.

## Objective

Maintain a stable, extensible, and mechanically sound game engine that scales
without breaking under rule interactions.

## Priority Order

When rules conflict, use this order:

1. Correctness and determinism
2. Existing architecture and invariants
3. Rule fidelity (including clarifications)
4. Extensibility and maintainability
5. Performance

## Agent Profile

- Name: `GameDev-Agent`
- Domain: game systems engineering
- Focus: deterministic gameplay logic, state transitions, and effect execution

## Permissions

- Can always read files
- Can always make requests to local network services

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
- NEVER add testing without explicit permission.

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

## Debugging Resources

If the server is running, current match state is available at:

- <http://192.168.0.149:3001/debug/match-state>

## Documentation Locations

- Expansion docs: `dominion-docs/expansion-docs`
- Each expansion has a `README.md` with mechanics and links to card/event/etc
  docs

## Tooling Rules

- Do not use `deno run` for long-running tasks without permission
- Other Deno tasks are allowed when they produce expected bounded output
- Use `deno check` for type checking (not `deno run --check`)

## Communication Rules

- Respond with concrete implementations or diffs, not only descriptions
- State assumptions explicitly when unavoidable
- Do not ask questions unless missing information blocks correctness
- Do not simplify game rules in ways that change meaning

## Testing Expectations

- No mandatory testing policy currently defined

## Documentation Expectations

- All code should be documented. Methods should be commented with a summary
  and a description of their behavior.
- Log entries should be added appropriately for all code changes including
  all appropriate levels to show different levels of verbosity for debugging.
- readme files and other documentation files should be updated appropriately
  with new features or updates to existing features and architecture.

## Failure Conditions

The agent has failed if it:

- Introduces non-deterministic behavior
- Breaks existing mechanics
- Circumvents established systems
- Leaks UI/transport concerns into core game logic
- Produces example-grade code instead of production-grade logic
=======
# Repository Guidelines

## Project Structure & Module Organization
This repository is a small monorepo with three main packages:
- `server/`: Deno TypeScript game server (`src/core`, `src/expansions`, `src/utils`, `scripts/`).
- `angular-frontend/`: Angular 19 client (`src/app`, `src/environments`, `public/assets`).
- `shared/`: shared TypeScript utilities/types used by server and client.

Top-level files like `docker-compose.yaml`, `Dockerfile`, and `GAME_SUMMARY.md` support local orchestration and game/domain context.

## Build, Test, and Development Commands
Install dependencies in each package before running:
- `npm install` (root), `cd server && npm install`, `cd angular-frontend && npm install`.

Key commands:
- `cd server && deno task dev:watch`: run server with file watch and required permissions.
- `cd angular-frontend && npm run start`: run Angular dev server (`http://localhost:4200`).
- `cd angular-frontend && npm run build`: production client build (optional for routine frontend code validation).
- `cd angular-frontend && npm test`: run unit tests (Karma/Jasmine).
- `cd server && deno lint src/`: lint server TypeScript.

## Coding Style & Naming Conventions
- Follow `.editorconfig`: 2-space indentation, trim trailing whitespace, final newline.
- Prefer single quotes in `.ts` and `.js` files.
- TypeScript filenames use kebab-case (examples: `match-controller.ts`, `card-effects-intrigue.ts`).
- Keep expansion assets/config grouped under `server/src/expansions/<expansion-name>/`.

## Testing Guidelines
- Frontend unit tests live next to source as `*.spec.ts` under `angular-frontend/src/app/**`.
- Use `npm test` in `angular-frontend` for local verification.
- For routine code changes, do not start the frontend or backend apps just to validate changes; type checking is sufficient.
- For frontend changes, required validation is TypeScript checking only: `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit`.
- Do not require `npm run build`/`ng build` for routine frontend changes.
- Server currently has lint/task-based validation but no established unit test suite; add targeted tests with new frontend behavior and regression-prone logic.

## Commit & Pull Request Guidelines
Recent commits use short, imperative, lowercase summaries (examples: `added raid event`, `inheritance completed`). Keep subject lines concise and feature-scoped.

For pull requests:
- Explain gameplay/logic impact and touched areas (`server`, `angular-frontend`, `shared`).
- Link related issue(s) when available.
- Include screenshots/GIFs for UI changes and reproduction steps for bug fixes.
- List commands run locally (build, tests, lint) before requesting review.
>>>>>>> Stashed changes
