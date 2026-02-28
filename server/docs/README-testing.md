# Server Unit Testing

This repository uses Deno's native test runner for server-side unit tests.

## Run tests

From `server/`:

```bash
deno task test:unit
```

Watch mode:

```bash
deno task test:unit:watch
```

Coverage (LCOV output at `coverage/lcov.info`):

```bash
deno task test:unit:coverage
```

## Test placement and naming

- Co-locate tests with source code under `src/`.
- Place tests inside nearby `__tests__/` folders.
- Use `*.spec.ts` filenames.

Example:

- `src/utils/fisher-yates-shuffler.ts`
- `src/utils/__tests__/fisher-yates-shuffler.spec.ts`

## Test helper utilities

Reusable test helpers live in `src/testing/`.

Current helpers include:

- `create-test-card.ts`: build deterministic `CardNoId` fixtures.
- `create-test-match-configuration.ts`: build complete match configuration fixtures.
- `create-test-expansion-data.ts`: build expansion metadata fixtures.
- `create-test-logger.ts`: capture logger output for assertions.
- `create-test-container.ts`: create Awilix test containers.
- `prompt-service-stub.ts`: queue prompt responses for action/prompt tests.

## Service test style

Service unit tests should resolve services through an Awilix test container.

Pattern:

1. Create a test container using `createTestContainer()`.
2. Register dependencies as `asValue(...)` mocks/stubs.
3. Register the service under test with `asClass(...)`.
4. Resolve the service from the container and assert behavior.

## Determinism rules

- Inject deterministic randomness (do not rely on ambient `Math.random()` in assertions).
- Avoid server/process bootstrapping in unit tests.
- Keep filesystem/network dependencies out of unit tests unless explicitly isolated.
