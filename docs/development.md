# Development Guide

Everything you need to build, run, and deploy the Dominion card game.

## Project Structure

```
.
├── server/             # Deno TypeScript game server (Socket.IO)
├── angular-frontend/   # Angular 19 web client
├── shared/             # Shared TypeScript types/utilities (no build step)
└── docker/             # Dockerfiles and container configuration
```

See `server/README.md` and `angular-frontend/README.md` for package-level details.

## Prerequisites

- [Deno](https://deno.land/) (v2+)
- [Node.js](https://nodejs.org/) (v20+) and npm/yarn
- [Docker](https://www.docker.com/) (optional, for containerized deployment)

## Quick Start (Local Development)

Install dependencies:

```bash
# root (optional, for concurrently)
npm install

# server
cd server && npm install

# web client
cd angular-frontend && npm install
```

Run both server and client:

```bash
# in separate terminals:
cd server && deno task dev:watch        # game server on http://localhost:3001
cd angular-frontend && npm run start    # web client on http://localhost:51455
```

The Angular dev server proxies `/socket.io` and `/debug` requests to the game server at `127.0.0.1:3001`.

## Authentication

The server ships with no default accounts. New accounts are created via open
email-based registration at `POST /auth/register` — no invite code is required.
Bootstrap the first user via the CLI scripts with the server stopped; see
[server/README.md](../server/README.md#authentication-usage) for the full
workflow and HTTP endpoint reference.

### Email confirmation in local development

When `STORAGE_BACKEND=supabase` and the local Supabase CLI stack is running
(`supabase start`), outbound email is not delivered to real inboxes. Instead,
the Supabase CLI starts an **Inbucket**-based email capture server. All emails
sent by Supabase Auth (confirmation links, password resets, etc.) are
intercepted and available at:

```
http://localhost:54324
```

Open that URL in a browser after registering a new account to retrieve the
confirmation link and click through it — no real mail server or SMTP
credentials are needed for local development.

The `[auth.email]` section of `supabase/config.toml` has
`enable_confirmations = true`, which is the setting that gates first login
behind email verification. The Inbucket server is configured in the
`[inbucket]` section of the same file (port `54324`).

When `STORAGE_BACKEND=in-memory`, no email is sent at registration and no
confirmation step exists. All data is lost when the server process exits.

### Supabase SMTP (hosted project)

When targeting a hosted Supabase project (not the local CLI stack), Supabase's
free tier allows only 2 outbound auth emails per hour. For any real usage,
configure a custom SMTP provider in the Supabase dashboard under
**Authentication → SMTP Settings**. The project uses [Resend](https://resend.com)
as its SMTP provider:

| Field | Value |
|-------|-------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (`re_...`) |
| Sender email | a verified address on your Resend domain |

A verified sending domain must be configured in Resend before outbound email
works. The confirmation email link uses the **Site URL** configured in
**Authentication → URL Configuration** — set this to the frontend URL
(e.g. `http://localhost:51455` for local dev or the production FQDN).

### Applying Supabase migrations

SQL migrations live in `supabase/migrations/`. To apply them to a hosted
Supabase project:

```bash
# Link to the project once (project-ref is the ID in the dashboard URL)
supabase link --project-ref <project-ref>

# Push pending migrations
supabase db push
```

`supabase db push` is idempotent — it only applies migrations that have not
been recorded in the project's migration history table.

## Docker

Docker images are built from the `docker/` directory. Both Dockerfiles expect to be built from the repository root so they can copy the `shared/`, `server/`, and `angular-frontend/` directories.

### Building Images

```bash
# game server
docker build -f docker/DockerFile_server -t dominion-server .

# web client
docker build -f docker/DockerFile_web_app -t dominion-web .
```

### Running Containers

```bash
# game server (default port 3000 inside container)
docker run -d -p 3000:3000 --name dominion-server dominion-server

# web client (nginx on port 80; WS_HOST is the upstream nginx proxies to)
docker run -d -p 8080:80 \
  --link dominion-server \
  -e WS_HOST=http://dominion-server:3000 \
  --name dominion-web dominion-web
```

Then open `http://localhost:8080` in your browser. The browser only ever talks to the frontend nginx; nginx forwards `/auth/`, `/socket.io/`, `/debug/`, and `/status` to the server using the `WS_HOST` URL.

### Server Docker Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the game server listens on inside the container |

All other server environment variables listed in `server/README.md` can also be passed with `-e`.

### Web App Docker Configuration

**Build args** (passed with `--build-arg`):

| Arg | Default | Description |
|-----|---------|-------------|
| `BUILD_CONFIG` | `production` | Angular build configuration (`production` or `development`) |

**Runtime environment variables** (passed with `-e`):

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_HOST` | `http://localhost:3000` | Upstream backend URL that nginx proxies `/auth/`, `/socket.io/`, `/debug/`, and `/status` to. The browser only ever talks to the nginx origin. |
| `WS_HOST_OVERRIDE` | _(unset)_ | Optional. When set, written verbatim into `env.js` so the Angular bundle issues fully-qualified backend requests instead of relative URLs. Only useful when bypassing the nginx proxy. |

`docker/env.sh` runs at container startup and:

1. Writes `env.js` with `wsHost: ''` (or the value of `WS_HOST_OVERRIDE` when set) so the Angular app issues relative-URL requests by default.
2. Generates `/etc/nginx/conf.d/proxy-locations.conf` with `proxy_pass` blocks pointing at `WS_HOST`. `nginx.conf` includes that file so the proxy rules are applied without rebuilding the image.
3. Generates `/etc/nginx/conf.d/security-headers.conf` with the CSP and other headers.

### Example: Custom Ports

```bash
# server on port 4000
docker run -d -p 4000:4000 -e PORT=4000 dominion-server

# web client whose nginx proxies to a custom backend host
docker run -d -p 9090:80 -e WS_HOST=http://192.168.1.100:4000 dominion-web
```

## Development Docker Compose

A `docker-compose.dev.yml` is provided for local development with hot-reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This starts the game server on port 3001 and the Angular dev server on port 51455. Source files are bind-mounted so changes are picked up immediately by `ng serve`.

### Local secrets (`./.env`)

`docker-compose.dev.yml` references secrets via `${VAR}` interpolation rather than embedding them inline. Compose reads them automatically from a gitignored `./.env` at the repository root. Currently used:

| Variable | Required when | Notes |
|----------|---------------|-------|
| `SUPABASE_URL` | `STORAGE_BACKEND=supabase` | Project URL — not secret but kept alongside the key for symmetry |
| `SUPABASE_SERVICE_ROLE_KEY` | `STORAGE_BACKEND=supabase` | Service-role key. Bypasses RLS — never commit. The repo's `.gitignore` rule `**/.env` keeps the file out of version control |

If you switch the dev stack to `STORAGE_BACKEND=in-memory`, neither variable needs to be set; Compose will pass empty strings through and the in-memory branch ignores them.

**Important — rebuild when dependencies change**: The dev frontend image installs `node_modules` at build time (inside the container) so the correct musl-compatible binaries are used on Alpine Linux. When `angular-frontend/package.json` or `shared/package.json` changes, the image must be rebuilt:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Without a rebuild after a dependency change, the container will use stale `node_modules` and may fail with missing native module errors (e.g. `@rollup/rollup-linux-x64-musl`).

## Production Docker Compose (Local Testing)

A `docker-compose.prod.yml` is provided for testing production images locally:

```bash
docker compose -f docker-compose.prod.yml up --build
```

This starts the server on port 3000 and the frontend on port 80. The frontend nginx proxies backend paths to the server via `WS_HOST=http://server:3000` (the docker-compose service hostname), so the browser only talks to the frontend on port 80.

## CI/CD Pipeline

The project uses **GitHub Actions** for continuous integration and for building/publishing release images to **GitHub Container Registry (GHCR)**. There is no automatic deployment step — rolling a new image out to production is a manual pull on the host. See [Production Deployment](#production-deployment-self-hosted-on-unraid) below.

### Continuous Integration

CI runs on every push and pull request, scoped by path filters so only relevant workflows trigger:

| Workflow | File | Trigger Paths | What It Does |
|----------|------|---------------|--------------|
| Server CI | `.github/workflows/server-ci.yml` | `server/**`, `shared/**` | Deno lint + type-check |
| Server Unit Tests | `.github/workflows/server-unit-tests.yml` | `server/**`, `shared/**` | Deno unit tests with coverage |
| Frontend CI | `.github/workflows/frontend-ci.yml` | `angular-frontend/**`, `shared/**` | TypeScript type-check |

### Release Image Publishing

Publishing a GitHub release with a semver tag (`vX.Y.Z`) builds and pushes both the server and frontend images together from the same release — a single tag covers both components (see `server/deno.json#version` and `angular-frontend/package.json#version`, both stamped to match the release tag during the build).

| Tag pattern | Built images |
|-------------|-------------|
| `vX.Y.Z` | `ghcr.io/<owner>/dominion-clone-server:X.Y.Z` and `ghcr.io/<owner>/dominion-clone-frontend:X.Y.Z` (both also tagged `:latest`) |

| Workflow | File | Trigger | What It Does |
|----------|------|---------|--------------|
| Build and Push | `.github/workflows/build-and-push.yml` | GitHub release published with `vX.Y.Z` tag | Builds and pushes both the server and frontend Docker images to GHCR |

```
GitHub release `vX.Y.Z`  → Build server image + Build frontend image  → GHCR
```

No deploy step follows automatically — see [Rolling Out a Release](unraid-operations.md#rolling-out-a-release) for the manual pull-and-restart flow on the Unraid host.

Bumping a version: edit `server/deno.json#version` and `angular-frontend/package.json#version` to the new version, commit, then create a `vX.Y.Z` GitHub release pointing at that commit. Both images are stamped from the same tag, so both files should be updated to the same version before tagging. The runtime versions surfaced in logs and the UI read from those two files, so the file changes must precede the release tag.

### Version Sources

Both the server and frontend share the same semver from the release tag. Both files must be updated to the same version before tagging:

| Component | Source field | Surfaced where |
|-----------|--------------|----------------|
| Server | `server/deno.json` → `version` | Startup log line, `serverHello` socket event, `GET /status` JSON |
| Frontend | `angular-frontend/package.json` → `version` | Scene-banner header pill, in-match game-log settings footer, admin debug runtime overlay |

### Required GitHub Secrets

None. GHCR pushes authenticate with the workflow's built-in `GITHUB_TOKEN` (granted `packages: write` in the workflow's `permissions:` block) — no repository secrets need to be configured for CI or image publishing.

## Production Deployment (Self-Hosted on Unraid)

The application runs as two Docker containers on a self-hosted Unraid server, pulling prebuilt images from GHCR. Public access is via a Cloudflare Tunnel — no ports are published on the host.

### Architecture

```
Cloudflare edge → Cloudflare Tunnel → cloudflared container
                                            │
                                            ▼ (shared Docker network)
                                     frontend container (nginx + Angular SPA)
                                            │ proxies /auth, /socket.io, /debug, /status
                                            ▼ (app Docker network)
                                     server container (Deno game server)
                                            │
                                            ▼
                                        Supabase (auth + game data)
```

The frontend nginx **reverse-proxies** `/auth/`, `/socket.io/`, `/debug/`, and `/status` to the `server` container over the compose network, so the browser only ever talks to the public hostname. See [unraid-operations.md](unraid-operations.md) for day-to-day operations — manually updating containers, setting environment variables and secrets, viewing logs, managing GHCR images, and troubleshooting.

### Container Topology

| Container | Purpose |
|-----------|---------|
| `server` | Deno game server with Socket.IO/WebSocket, port 3000 (internal only) |
| `frontend` | nginx serving the Angular SPA, reverse-proxies backend paths, port 80 (internal only) |
| `cloudflared` | Cloudflare Tunnel client, provides the only path in from the public internet |

`docker-compose.unraid.yml` (repo root) is the source of truth for image references, environment variables, and network wiring.

### Rollback

Set `SERVER_VERSION` / `FRONTEND_VERSION` in the host's `.env` back to a previous released semver, then `docker compose pull && docker compose up -d`. See [unraid-operations.md#rollback](unraid-operations.md#rollback).

### Scaling Note

The stack runs a single replica of each service. Scaling the server beyond one replica would require session affinity for Socket.IO, which is not currently configured.
