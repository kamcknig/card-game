---
date: 2026-03-26
git_commit: d29d0c7b
branch: cicd
repository: kamcknig/card-game
topic: Build process for local development and production
tags: [build, docker, development, production, ci-cd, deno, angular]
status: complete
---

# Build Process Research

This document describes the build, development, and production deployment processes for the card-game monorepo as of commit `d29d0c7b` on the `cicd` branch.

## Repository Structure (Build-Relevant)

```
card-game/
├── package.json                  # Root: concurrently for running server+frontend
├── docker-compose.dev.yml        # Docker Compose for dev containers
├── docker/
│   ├── Dockerfile_server         # Production server image
│   ├── Dockerfile_web_app        # Production frontend image (multi-stage)
│   ├── Dockerfile_dev_server     # Dev server image (hot-reload)
│   ├── Dockerfile_dev_frontend   # Dev frontend image (ng serve)
│   ├── nginx.conf                # Production nginx config
│   └── env.sh                    # Runtime env.js injection script
├── server/
│   ├── deno.json                 # Deno config, tasks, import map
│   └── .env-example              # Example environment variables
├── angular-frontend/
│   ├── package.json              # Angular scripts (start, build, test)
│   ├── angular.json              # Angular CLI config
│   ├── tsconfig.json             # Base TS config (paths: shared/*)
│   ├── tsconfig.app.json         # App-specific TS config
│   └── src/
│       ├── proxy.conf.json       # Dev proxy (localhost:3001)
│       ├── proxy.conf.docker.json # Docker dev proxy (server:3001)
│       └── environments/
│           ├── environment.ts            # Production env
│           └── environment.development.ts # Dev env
├── shared/
│   └── package.json              # Minimal: only fast-json-patch devDep
└── .github/workflows/
    └── server-unit-tests.yml     # CI: server unit tests + coverage
```

## Local Development

There are two ways to run locally: native (directly on the host) and Docker-based.

### Native Local Development

#### Prerequisites

- Deno (runtime for server)
- Node.js 20+ and npm (for Angular frontend)
- Install dependencies: `npm install` (root), `cd server && npm install`, `cd angular-frontend && npm install`

#### Running Both Server and Frontend

From root:
```bash
npm run watch
```

This uses `concurrently` to run both:
- `npm run watch:server` → `cd server && deno task dev:watch`
- `npm run watch:web` → `cd angular-frontend && npm run start`

Note: The root `package.json` scripts reference `watch:server` and `watch:web` but defines `server:watch` and `web:watch` — this appears to be a mismatch (the `watch` script calls `watch:server` and `watch:web` which don't exist as defined).

#### Server (`deno task dev:watch`)

Runs:
```bash
deno run --inspect --check --env-file --allow-sys --allow-read --allow-write --allow-net --allow-env --watch src/server.ts
```

- **Entry point**: `server/src/server.ts`
- **Port**: `3001` (from `.env` file, `PORT=3001`)
- **Hot-reload**: Deno's built-in `--watch` flag restarts on file changes
- **Type-checking**: `--check` flag enables runtime type-checking
- **Debugging**: `--inspect` enables Chrome DevTools debugging
- **Environment**: `--env-file` loads from `server/.env`

The server entry point creates an Awilix DI container, registers root services, and calls `startServer()` which resolves `ServerBootstrapService` and starts it.

#### Frontend (`npm run start` → `ng serve`)

- **Port**: `51455` (configured in `angular.json`)
- **Host**: `0.0.0.0` (accessible from other machines on the network)
- **Proxy**: `src/proxy.conf.json` proxies `/socket.io/**` and `/debug/**` to `http://127.0.0.1:3001`
- **Build config**: defaults to `development` configuration
- **Development config**: disables optimization, enables source maps, replaces `environment.ts` with `environment.development.ts`

#### Environment Configuration

The frontend reads `window.__env.wsHost` at runtime (set by `env.js`). In local dev without Docker, `env.js` does not exist, so both `environment.ts` and `environment.development.ts` fall back to `'http://localhost:3000'` via the nullish coalescing operator.

The proxy config on port 51455 forwards Socket.IO traffic to the server at port 3001, so the actual connection path is:
- Browser → `localhost:51455` (ng serve) → proxy → `localhost:3001` (Deno server)

### Docker-Based Local Development

#### Docker Compose (`docker-compose.dev.yml`)

Compose project name: `card-game-dev`

Two services: `frontend` and `server`.

#### Dev Server Container (`Dockerfile_dev_server`)

- **Base**: `denoland/deno:2.7.7`
- **Working directory**: `/app/server`
- **No COPY of source**: source code is bind-mounted from host via volumes (`./server:/app/server`, `./shared:/app/shared`)
- **Command**: `deno run --check --allow-net --allow-env --allow-read --allow-write --allow-sys --watch src/server.ts`
  - Same as native `dev:watch` minus `--inspect` and `--env-file`
- **Port**: `3001`
- **Environment** (from compose): `PORT=3001`, `LOG_TO_FILE=true`, `LOG_FILE_MAX_BYTES=5242880`, `GAME_DATA_ROOT=./game-data`, `MATCH_STATE_EXPORT_ENABLED=true`, `END_MATCH_ON_NO_HUMANS=true`, `LOG_COLOR=true`, `MATCH_STATE_MERGE_ENABLED=true`

#### Dev Frontend Container (`Dockerfile_dev_frontend`)

- **Base**: `node:20-alpine`
- **Working directory**: `/app/angular-frontend`
- **No COPY of source**: source code is bind-mounted (`./angular-frontend:/app/angular-frontend`, `./shared:/app/shared`)
- **Proxy override**: mounts `proxy.conf.docker.json` as `proxy.conf.json` — targets `http://server:3001` instead of `http://127.0.0.1:3001` (Docker networking)
- **Entrypoint**: runs `env.sh` then `npx ng serve`
- **env.sh**: writes `window.__env = { wsHost: '${WS_HOST}' }` to `$ENV_JS_DIR/env.js`
  - `ENV_JS_DIR=/app/angular-frontend/public` (so ng serve serves it)
  - `WS_HOST=` (empty string, so socket.io connects to same origin, proxied by ng serve)
- **Port**: `51455`

#### Hot-Reload in Docker

Both containers get hot-reload through bind-mounted volumes:
- Server: Deno `--watch` detects changes to the bind-mounted `./server` directory
- Frontend: `ng serve` detects changes to the bind-mounted `./angular-frontend` directory

## Production Build

There is no production Docker Compose file in the repository. Production builds are handled by individual Dockerfiles.

### Production Server (`Dockerfile_server`)

- **Base**: `denoland/deno:2.7.7`
- **Build**: copies `shared/` and `server/` into the image, runs `deno install --entrypoint src/server.ts` to cache dependencies
- **Runtime**: `deno run --allow-net --allow-env --allow-read --allow-write --allow-sys --node-modules-dir=manual src/server.ts`
  - No `--watch`, no `--check`, no `--inspect`
  - Adds `--node-modules-dir=manual` for npm package resolution
- **Default port**: `3000` (different from dev's `3001`)

### Production Frontend (`Dockerfile_web_app`)

Multi-stage build:

**Stage 1 (Build)**:
- Base: `node:20-alpine`
- Installs shared dependencies (`cd shared && yarn install --frozen-lockfile`)
- Installs frontend dependencies (`cd angular-frontend && yarn install --frozen-lockfile`)
- Builds Angular app: `yarn ng build --configuration=$BUILD_CONFIG` (default: `production`)
- Output: `angular-frontend/dist/angular-frontend/browser/`

**Stage 2 (Serve)**:
- Base: `nginx:alpine`
- Copies built files to `/usr/share/nginx/html/`
- Copies `nginx.conf` and `env.sh`
- `env.sh` runs as a Docker entrypoint script to inject runtime environment variables into `env.js`

**nginx.conf**:
- Serves on port 80
- SPA fallback: `try_files $uri $uri/ /index.html`
- Static asset caching: 1 year with `Cache-Control: public, immutable` for js, css, images, fonts
- Note: nginx does NOT proxy to the server — the production frontend connects directly to the server via `wsHost` (injected at runtime by `env.sh`)

### Production Environment Configuration

- `env.sh` generates `env.js` with `wsHost` from the `WS_HOST` environment variable
- Default `WS_HOST` if unset: `http://localhost:3000`
- The production frontend reads `window.__env.wsHost` from `env.js` (loaded by `index.html`) and connects Socket.IO directly to that host
- This means production requires the `WS_HOST` env var to be set to the actual server address when running the container

### Angular Production Build Settings

From `angular.json`, production configuration:
- Bundle budgets: initial bundle warning at 500kB, error at 1MB; component styles warning at 4kB, error at 8kB
- Output hashing: all files get content hashes in filenames

## Shared Package

- No build step — TypeScript consumed directly by both server and frontend
- Frontend resolves via tsconfig path: `shared/*` → `../shared/src/*`
- Server resolves via deno.json import map: `@shared/` → `../shared/src/`, `shared/types/` → `../shared/src/types/`
- Only dependency: `fast-json-patch` (devDep)
- In Docker builds: source is either bind-mounted (dev) or copied (production)

## CI/CD

### GitHub Actions: Server Unit Tests

File: `.github/workflows/server-unit-tests.yml`

**Trigger**: push or pull_request when `server/**`, `shared/**`, or the workflow file changes.

**Steps**:
1. Checkout repository
2. Setup Deno 2.7.1
3. `deno install` (server dependencies)
4. `npm install` (shared dependencies)
5. `deno task test:unit:coverage` — runs tests with coverage, generates lcov and HTML reports
6. Uploads coverage artifact (`server/coverage`)

**No frontend CI workflow exists** in the repository.

**No deployment pipeline exists** in the repository — there are no workflows for building Docker images, pushing to a registry, or deploying.

## Validation Commands Summary

| Context | Command | Purpose |
|---------|---------|---------|
| Server type-check | `cd server && deno check --no-lock src/server.ts` | Type-check server |
| Server lint | `cd server && deno lint src/` | Lint server code |
| Server format | `cd server && deno task fmt` | Format with oxfmt |
| Server tests | `cd server && deno task test:unit` | Run unit tests |
| Frontend type-check | `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit` | Type-check frontend (preferred routine validation) |
| Frontend build | `cd angular-frontend && npm run build` | Full production build |
| Frontend tests | `cd angular-frontend && npm test` | Karma/Jasmine tests |
| Both dev | `npm run watch` (root) | Run both with concurrently |

## Key Observations

- The root `package.json` `watch` script references `watch:server` and `watch:web` but defines `server:watch` and `web:watch` — these names don't match, so `npm run watch` from root would fail.
- Production server defaults to port `3000` while development defaults to `3001`.
- No production Docker Compose file exists; production containers would need to be orchestrated separately.
- No CI/CD for frontend builds, Docker image builds, or deployment.
