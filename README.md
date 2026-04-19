# Dominion Card Game

A multiplayer Dominion card game implementation with a Deno game server and Angular web client.

## Project Structure

```
.
├── server/             # Deno TypeScript game server (Socket.IO)
├── angular-frontend/   # Angular 19 web client
├── shared/             # Shared TypeScript types/utilities (no build step)
└── docker/             # Dockerfiles and container configuration
```

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

The server ships with no default accounts and no open self-registration —
every account is created via `POST /auth/register` using a registration code
issued by an authenticated user. Bootstrap the first user via the CLI scripts
with the server stopped; see [server/README.md](server/README.md#authentication-usage)
for the full workflow and HTTP endpoint reference.

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

# web client (nginx on port 80, point WS_HOST to the server)
docker run -d -p 8080:80 -e WS_HOST=http://localhost:3000 --name dominion-web dominion-web
```

Then open `http://localhost:8080` in your browser.

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
| `WS_HOST` | `http://localhost:3000` | WebSocket server URL the client connects to |

The `WS_HOST` variable is injected at container startup via `docker/env.sh`, which writes a `env.js` file loaded by the Angular app before bootstrapping.

### Example: Custom Ports

```bash
# server on port 4000
docker run -d -p 4000:4000 -e PORT=4000 dominion-server

# web client connecting to server at a custom host
docker run -d -p 9090:80 -e WS_HOST=http://192.168.1.100:4000 dominion-web
```

See `server/README.md` and `angular-frontend/README.md` for more details on each package.

## CI/CD Pipeline

The project uses **GitHub Actions** for continuous integration and continuous deployment targeting **Microsoft Azure**.

### Continuous Integration

CI runs on every push and pull request, scoped by path filters so only relevant workflows trigger:

| Workflow | File | Trigger Paths | What It Does |
|----------|------|---------------|--------------|
| Server CI | `.github/workflows/server-ci.yml` | `server/**`, `shared/**` | Deno lint + type-check |
| Server Unit Tests | `.github/workflows/server-unit-tests.yml` | `server/**`, `shared/**` | Deno unit tests with coverage |
| Frontend CI | `.github/workflows/frontend-ci.yml` | `angular-frontend/**`, `shared/**` | TypeScript type-check |

### Continuous Deployment

CD triggers when a GitHub release is published and flows through two workflows:

| Workflow | File | Trigger | What It Does |
|----------|------|---------|--------------|
| Build and Push | `.github/workflows/build-and-push.yml` | GitHub release published | Builds Docker images and pushes to ACR with the release tag and `latest` |
| Deploy | `.github/workflows/deploy.yml` | Successful Build and Push run | Deploys the release-tagged images to Azure Container Apps |

```
GitHub release published → Build & Push (ACR) → Deploy (Azure Container Apps)
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Service principal JSON for Azure login |
| `ACR_LOGIN_SERVER` | ACR login server (e.g. `turkeysunite.azurecr.io`) |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `AZURE_RESOURCE_GROUP` | Azure resource group name |
| `AZURE_SERVER_APP_NAME` | Server Container App name |
| `AZURE_FRONTEND_APP_NAME` | Frontend Container App name |

## Production Deployment (Azure)

The application runs on **Azure Container Apps** within the `turkeysunite` resource group.

### Architecture

```
Azure Container Apps Environment (card-game-env)
├── dominion-clone-server    ← Deno game server, port 3000, external ingress
└── dominion-clone-frontend  ← nginx + Angular static files, port 80, external ingress
```

Both apps have external ingress and are accessible via their `.azurecontainerapps.io` FQDNs (HTTPS provided by default). The frontend connects to the server directly via the `WS_HOST` environment variable — nginx does not proxy WebSocket traffic.

### Azure Services

| Service | Purpose |
|---------|---------|
| Resource Group: `turkeysunite` | Contains all project resources |
| Azure Container Registry (ACR) | Stores Docker images (`dominion-clone-server`, `dominion-clone-frontend`) |
| Azure Container Apps Environment | Shared networking layer for containers |
| Container App: `dominion-clone-server` | Deno game server with Socket.IO/WebSocket |
| Container App: `dominion-clone-frontend` | nginx serving the Angular SPA |

### Server Environment Variables (Production)

| Variable | Value | Description |
|----------|-------|-------------|
| `PORT` | `3000` | Server listen port |
| `LOG_TO_FILE` | `false` | Disable file logging in container |
| `GAME_DATA_ROOT` | `./game-data` | Game data directory |
| `END_MATCH_ON_NO_HUMANS` | `true` | End matches when all humans leave |
| `MATCH_STATE_MERGE_ENABLED` | `true` | Enable match state merging |
| `AUTH_ALLOWED_ORIGINS` | _(required)_ | Comma-separated CORS origin allowlist for `/auth/*` (e.g. the frontend FQDN) |
| `AUTH_SESSION_STORE` | `kv` | Set to `kv` for persistent sessions across restarts |
| `AUTH_KV_PATH` | `./game-data/auth.kv` | Path to the Deno KV store (mount Azure Files at the containing directory for durability) |
| `AUTH_LOCKOUT_THRESHOLD` | `5` | Failed logins before per-account lockout |
| `AUTH_LOCKOUT_DURATION_MS` | `600000` | Account lockout duration (ms) |
| `AUTH_MIN_PASSWORD_LENGTH` | `10` | Minimum password length for registration and password change |

### Frontend Environment Variables (Production)

| Variable | Description |
|----------|-------------|
| `WS_HOST` | Full URL to the server Container App (e.g. `https://dominion-clone-server.<region>.azurecontainerapps.io`) |

### Rollback

Azure Container Apps maintains revision history. Roll back by activating a previous revision:

```bash
# List revisions
az containerapp revision list \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --output table

# Activate a previous revision
az containerapp revision activate \
  --revision <previous-revision-name> \
  --resource-group turkeysunite
```

### Azure Operations

For day-to-day Azure operations — manually updating containers, setting environment variables and secrets, viewing logs, managing ACR images, and troubleshooting — see [docs/azure-operations.md](docs/azure-operations.md).

### Scaling Note

The server currently runs with 1 replica. If scaling beyond 1 replica, session affinity must be enabled for Socket.IO:

```bash
az containerapp ingress sticky-sessions set \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --affinity sticky
```

## Production Docker Compose (Local Testing)

A `docker-compose.prod.yml` is provided for testing production images locally:

```bash
docker compose -f docker-compose.prod.yml up --build
```

This starts the server on port 3000 and the frontend on port 80, with the frontend's `WS_HOST` pointing to `http://localhost:3000`.
