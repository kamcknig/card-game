# Server Unit Testing

Write, extend, and maintain server unit tests with deterministic behavior, shared test infrastructure, and coverage-driven targeting.

Use this skill when requests include phrases like "add tests for", "add unit tests", "improve test coverage", "write server tests", or when implementing new server behavior that should be regression-tested.

## When To Use

Use for requests like:

- Add unit tests for a server module or utility
- Increase coverage for specific files or branches
- Write regression tests for a bug fix
- Add tests for new server features

Do not use this skill for:

- Frontend/Angular tests (`angular-frontend/` uses Karma/Jasmine)
- Integration or end-to-end tests
- Writing production code (`/expansion-effects-authoring`, `/action-engine-authoring`, etc.)

## Test Framework

- **Runtime**: Deno's built-in `Deno.test()` — no external test framework.
- **Assertions**: `@std/assert` from JSR (`assertEquals`, `assertStrictEquals`, `assertNotStrictEquals`, `assertThrows`).
- **Async**: Native `async/await` in `Deno.test()`.
- **No mocking library**: Tests use manual stubs, test doubles, and type casting.

## Test File Conventions

- Test files live in `__tests__/` subdirectories adjacent to source: `server/src/<area>/__tests__/<module>.spec.ts`.
- One spec file per source module.
- File naming: `<source-module-name>.spec.ts` (kebab-case, matching source).
- Imports use the same path aliases as production code (`shared/types/index.ts`, `@server-types/index.ts`, `@std/assert`).
- `server/src/testing/` is excluded from test discovery via `deno.json` `test.exclude`. Do not place test spec files there.

## Shared Test Infrastructure

All shared test utilities live in `server/src/testing/`. Always check for and reuse these before creating inline helpers.

### Available Test Factories

| Module | Purpose | Key API |
|--------|---------|---------|
| `create-test-player.ts` | Player fixture factory with auto-incrementing IDs | `createTestPlayer(overrides?)` — accepts partial player fields |
| `create-test-card.ts` | Card fixture factory with auto-incrementing keys | `createTestCard(overrides?)` — accepts partial card fields |
| `create-test-expansion-data.ts` | Expansion data fixture | `createTestExpansionData(overrides?)` |
| `create-test-match-configuration.ts` | Match configuration fixture | `createTestMatchConfiguration(overrides?)` |
| `create-test-container.ts` | Awilix DI container setup for service tests | `createTestContainer()` |
| `create-test-logger.ts` | Logger spy that captures log entries | `createTestLogger()` — returns `{ entries, loggerService }` |
| `prompt-service-stub.ts` | PromptService test double | `new PromptServiceStub()` — queue responses with `enqueueActions()`, inspect via `requestedActions` |

### Match State Factory

- `createInitialMatchState()` from `server/src/core/match-state-factory.ts` — produces a valid empty `Match` object for state-dependent tests.

### Usage Patterns

**Fixture factories accept partial overrides** to customize per-test:
```typescript
const player = createTestPlayer({ id: 5, name: 'Custom' });
const card = createTestCard({ cardKey: 'village', cost: { treasure: 3 } });
```

**Logger spy captures entries by level for assertion**:
```typescript
const { entries, loggerService } = createTestLogger();
someFunction(loggerService);
assertEquals(entries.some(e => e.level === 'warn'), true);
```

**PromptServiceStub replays queued actions sequentially**:
```typescript
const promptService = new PromptServiceStub();
promptService.enqueueActions(1, 2, 0);  // queue three responses
const result = await asyncFunction(promptService);
assertEquals(promptService.requestedActions.length, 3);
```

**Partial match state for focused tests** (use `as unknown as Match` for minimal objects when full state is unnecessary):
```typescript
const match = { config: { basicSupply: [...] } } as unknown as Match;
```

**Service tests with manual stubs**:
```typescript
const loggerStub = { info: () => {}, debug: () => {} } as unknown as LoggerService;
const service = new MyService(loggerStub);
```

## Workflow

1. **Identify the target module** and read its source to understand all branches, edge cases, and dependencies.
2. **Check existing coverage** — if a `coverage/lcov.info` exists, parse it to find uncovered lines, functions, and branches for the target file.
3. **Read the existing test file** if one exists. Understand what is already covered and what patterns are in use.
4. **Inventory shared test utilities** in `server/src/testing/` — prefer reusing existing factories and stubs over creating new ones.
5. **Write new tests** targeting uncovered branches and edge cases:
   - One `Deno.test()` call per behavior or edge case.
   - Use descriptive test names that state the input condition and expected result.
   - Keep each test self-contained: set up state, call the function, assert results.
   - Prefer `assertEquals` for value comparisons, `assertStrictEquals` for reference identity, `assertThrows` for error paths.
6. **Validate type safety** — tests must pass `deno check` (type checking), not just runtime execution.
7. **Run tests** to verify all pass:
   ```bash
   deno test --no-lock --allow-env --allow-read --allow-sys=cpus src/<path>/__tests__/<file>.spec.ts
   ```
8. **Check for regressions** by running the full suite if changes touch shared infrastructure:
   ```bash
   deno test --no-lock --allow-env --allow-read --allow-sys=cpus src/
   ```

## Test Authoring Rules

- **Determinism**: Tests must produce the same result every run. Use fixed values, not random ones. Use `FixedRngService` (override `nextFloat()`) when testing randomness-dependent code.
- **Isolation**: Each test must be independent. Do not rely on execution order or shared mutable state between tests. Auto-incrementing IDs in factories prevent collision.
- **No file I/O**: All state is managed in memory. Tests should not read from or write to the filesystem.
- **No external services**: Tests should not make network calls or depend on running servers.
- **Type safety**: Avoid `as any`. Use `as unknown as Type` for partial interface implementations when a full object is unnecessary.
- **Minimal mocking**: Favor simple stubs and test doubles over complex mocking. Create inline objects matching the required interface shape.
- **Cover branches, not just lines**: Target `if/else`, `switch`, `??`, `?.`, and ternary branches explicitly. The coverage report's branch percentage is the key metric to improve.

## Extending Shared Test Infrastructure

When a test double or factory would be reused across 3+ test files:

1. Add it to `server/src/testing/` as a new module.
2. Follow the existing factory pattern: export a function accepting partial overrides, return a complete object with sensible defaults.
3. Use auto-incrementing IDs where applicable to prevent test collision.
4. Keep stubs minimal — implement only the interface methods needed, returning safe defaults (`null`, `[]`, `false`) for unexercised paths.

When a test double is only needed in a single test file, define it locally (file-level `const` or inner function) rather than adding it to shared infrastructure.

## Coverage Analysis

To identify coverage gaps, parse `server/coverage/lcov.info`:

- `LF`/`LH`: total/hit lines
- `FNF`/`FNH`: total/hit functions
- `BRF`/`BRH`: total/hit branches
- `DA:<line>,<hits>`: per-line hit counts (`0` = uncovered)

Prioritize files with:
1. Low branch coverage (most impactful for correctness)
2. Low function coverage (entire untested code paths)
3. Low line coverage in core/utils (high-value testable logic)

Skip files that are primarily type definitions, test infrastructure itself, or modules requiring external dependencies (file I/O, network).

## Validation Commands

Run a specific test file:
```bash
deno test --no-lock --allow-env --allow-read --allow-sys=cpus src/<area>/__tests__/<module>.spec.ts
```

Run all server unit tests:
```bash
deno test --no-lock --allow-env --allow-read --allow-sys=cpus src/
```

Run with coverage output:
```bash
deno test --no-lock --allow-env --allow-read --allow-sys=cpus --clean --coverage=coverage src/ && deno coverage coverage --lcov --output=coverage/lcov.info
```

Type-check a test file:
```bash
deno check --no-lock --config server/deno.json src/<area>/__tests__/<module>.spec.ts
```

## Completion Checklist

- All new tests pass with `deno test`.
- All new tests pass type checking with `deno check`.
- Shared test infrastructure was evaluated and reused where applicable.
- No duplicate test logic was introduced across test files.
- Branch coverage for targeted files improved.
- Test names clearly describe the behavior under test.
- No non-deterministic behavior (random values, timing, external state).
