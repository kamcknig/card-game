# Debug API + OpenAPI Docs

This document describes the server debug API documentation endpoints and how to
run them locally.

## Enable Debug API

The debug API is guarded by `MATCH_STATE_EXPORT_ENABLED`.

- Set `MATCH_STATE_EXPORT_ENABLED=true` to enable all `/debug/*` endpoints.
- Set `MATCH_STATE_MERGE_ENABLED=true` if you also want `PATCH` support on
  `/debug/games/:gameId/matches/:matchScopeId/state`.

## OpenAPI + Docs Endpoints

When debug API is enabled, these routes are available:

- `GET /debug/openapi.json`: OpenAPI 3.1 document for the debug API.
- `GET /debug/docs`: Swagger UI for the debug API.
- `GET /debug/reference`: Scalar API Reference for the debug API.

## Local Usage

1. Start the server with debug export enabled.
2. Open one of:
   - `http://localhost:3001/debug/docs`
   - `http://localhost:3001/debug/reference`
3. Use either UI to inspect and execute debug API requests.

## Maintenance Notes

- The OpenAPI document is spec-first and manually maintained in:
  `server/src/core/debug-openapi-spec.ts`.
- When debug routes change in
  `server/src/core/server-debug-route-handler-service.ts`, update the spec
  module in the same change.
