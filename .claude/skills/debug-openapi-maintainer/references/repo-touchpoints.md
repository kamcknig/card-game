# Debug OpenAPI Touchpoints

Use these files as the source of truth when changing debug API behavior and
documentation.

## Core Files

- `server/src/core/server-debug-route-handler-service.ts`
  - Runtime behavior for `/debug/*` HTTP endpoints.
  - Includes docs pages and OpenAPI JSON routes.
- `server/src/core/debug-openapi-spec.ts`
  - OpenAPI 3.1 spec that must reflect real endpoint behavior.
  - Keep path/method/params/responses synchronized with route handler logic.
- `server/docs/README-debug-api.md`
  - Human-facing usage notes for docs URLs and debug gating env vars.

## Current Docs Endpoints

- `GET /debug/openapi.json`
- `GET /debug/docs` (Swagger UI)
- `GET /debug/reference` (Scalar)

## Sync Checklist

1. Update route handler behavior.
2. Mirror changes in OpenAPI spec:
   - path and method
   - params and request body
   - status codes and response shapes
3. Update debug API README when endpoint surface or usage changes.
4. Verify default docs server target remains same-origin (`/`) unless
   intentionally changed.
