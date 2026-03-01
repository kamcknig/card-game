# Debug OpenAPI Maintainer

Maintain and evolve the server debug API and its OpenAPI documentation together. Use when adding, removing, or changing `/debug/*` endpoints, when requests mention creating/updating OpenAPI documentation, or when prompts include phrases like "create debug api", "update openapi documentation", or "add openapi documentation".

## Overview

Keep `server/src/core/debug-openapi-spec.ts` aligned with the actual debug
endpoint behavior in `server/src/core/server-debug-route-handler-service.ts`.
Update docs routes and debug endpoint contracts without introducing drift.

## Workflow

1. Read current debug route behavior first:
   - `server/src/core/server-debug-route-handler-service.ts`
2. Update endpoint behavior if requested.
3. Update OpenAPI spec in the same change:
   - `server/src/core/debug-openapi-spec.ts`
4. Keep docs endpoints accurate when relevant:
   - `GET /debug/openapi.json`
   - `GET /debug/docs`
   - `GET /debug/reference`
5. Update debug API docs when behavior or contracts change:
   - `server/docs/README-debug-api.md`
6. Run type checking for server changes.

## Contract Rules

- Keep path names, HTTP methods, and parameter names consistent between route
  handlers and OpenAPI paths.
- Keep query parameter defaults and enums synchronized with implementation.
- Keep error status coverage aligned with handler behavior:
  - Common statuses: `400`, `403`, `404`, `405`, `500` as applicable.
- Preserve debug API gating semantics (`MATCH_STATE_EXPORT_ENABLED`,
  `MATCH_STATE_MERGE_ENABLED`) in both behavior and docs.

## Docs UI Rules

- Prefer same-origin OpenAPI server (`/`) as default to avoid CORS issues in
  Swagger/Scalar "try it out" requests.
- Keep any fallback localhost server entries secondary, not primary.

## Validation

- Run:
  - `DENO_DIR=/tmp/deno-cache deno check --no-lock src/server.ts`
  - from `server/` directory
- If local Deno supports the lockfile version, also run:
  - `deno check src/server.ts`
