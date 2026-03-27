---
type: implementation-plan
repo: kamcknig/card-game
branch: cicd
sha: d0566a99db9bbeada003d2522ed68d323913d469
---

# CI/CD Pipeline Implementation Plan

## Overview

Establish a full CI/CD pipeline for the card-game monorepo using **GitHub Actions** for automation and **Microsoft Azure** for production hosting. The pipeline covers:

- Continuous integration (lint, type-check, test) on every push and PR
- Docker image build and push to **Azure Container Registry (ACR)** on merge to `master`
- Automated deployment to **Azure Container Apps** after a successful image push

### Architecture Summary

```
GitHub Repo (kamcknig/card-game)
  ├── CI (push/PR) → lint + type-check + unit tests
  └── CD (master merge)
        ├── Build & push server image  → ACR
        ├── Build & push frontend image → ACR
        └── Deploy both images         → Azure Container Apps
```

### Azure Services Used

| Service | Purpose |
|---|---|
| Resource Group: `turkeysunite` | Pre-existing resource group |
| Azure Container Registry (ACR) | Store Docker images |
| Azure Container Apps Environment | Shared networking for containers |
| Container App: `card-game-server` | Runs Deno game server (Socket.IO/WebSocket) |
| Container App: `card-game-frontend` | Runs nginx serving Angular static files |

## Current State Analysis

The repository already has production-ready Dockerfiles and a dev Docker Compose setup, but no CI/CD pipeline or production orchestration.

### Key Discoveries:

- Production server Dockerfile exists at `docker/Dockerfile_server` — Deno 2.7.7 base, exposes port 3000 by default
- Production frontend Dockerfile exists at `docker/Dockerfile_web_app` — multi-stage build (Node 24 build + nginx serve)
- Frontend uses runtime `env.js` injection via `docker/env.sh` to configure `WS_HOST` at container start
- Server reads `PORT` from env (default 3000 in production Dockerfile, 3001 in dev)
- Socket.IO connection uses WebSocket transport with polling fallback (`socket.service.ts:24-31`)
- nginx config (`docker/nginx.conf`) does NOT proxy to server — frontend connects directly via `wsHost`
- Root `package.json` watch script has a name mismatch: defines `server:watch`/`web:watch` but `watch` calls `watch:server`/`watch:web`
- Existing CI: only `.github/workflows/server-unit-tests.yml` (Deno 2.7.1, should be updated to 2.7.7)
- No frontend CI, no Docker build workflow, no deployment workflow
- The `shared` package uses `yarn install` for its dependencies

## Desired End State

After implementation:

1. **CI on every push/PR**: Server lint + type-check + unit tests; frontend type-check
2. **CD on master merge**: Docker images built and pushed to ACR, then deployed to Azure Container Apps
3. **Two Azure Container Apps** running in the `turkeysunite` resource group:
   - `card-game-server`: Deno server with Socket.IO on port 3000, external ingress
   - `card-game-frontend`: nginx serving Angular app on port 80, external ingress, `WS_HOST` pointing to server FQDN
4. **Rollback capability** via Azure Container Apps revision history

Verification: Visit the frontend FQDN in a browser, create a game lobby, and confirm WebSocket connection succeeds.

## What We're NOT Doing

- Custom domain or SSL certificate setup (Azure Container Apps provides HTTPS by default on `.azurecontainerapps.io`)
- Auto-scaling beyond 1 replica (can add later; sticky sessions needed for Socket.IO with >1 replica)
- Persistent storage or database setup (game state is in-memory)
- Monitoring, alerting, or Application Insights integration
- Branch-based preview environments

## Implementation Approach

Use Azure Container Apps for hosting because the app is already containerized, Container Apps has native WebSocket support, and it's cost-effective for a personal/hobby project (consumption-based pricing with free grants). The frontend and server run as separate Container Apps sharing a Container Apps Environment for internal networking. GitHub Actions handles CI/CD with separate workflows for CI (on push/PR) and CD (on master merge).

---

## Phase 1: Fix Pre-Existing Build Issues

### Overview
Resolve known build inconsistencies before building CI/CD around them.

### Changes Required:

#### 1.1 Fix Root Watch Script

**File**: `package.json`
**Changes**: Fix the `watch` script to reference the correct script names
**Status**: Already correct in current codebase — no change needed.

```json
{
  "scripts": {
    "watch": "concurrently \"npm:server:watch\" \"npm:web:watch\"",
    "server:watch": "cd server && deno task dev:watch",
    "web:watch": "cd angular-frontend && npm run start"
  }
}
```

#### 1.2 Update Production Frontend Dockerfile to Node 24

**File**: `docker/DockerFile_web_app`
**Changes**: Update the build stage from `node:20-alpine` to `node:24-alpine`
**Status**: Already `node:24-alpine` in current codebase — no change needed.

```dockerfile
# --- Build Stage ---
FROM node:24-alpine AS build
```

#### 1.3 Update Dev Frontend Dockerfile to Node 24

**File**: `docker/DockerFile_dev_frontend`
**Changes**: Update from `node:20-alpine` to `node:24-alpine`
**Status**: Already `node:24-alpine` in current codebase — no change needed.

```dockerfile
FROM node:24-alpine
```

#### 1.4 Add Production Docker Compose

**File**: `docker-compose.prod.yml` (new file at repo root)
**Changes**: Add a production compose file for local testing and reference

```yaml
# Production Docker Compose — for local production testing and reference.
# In production, Azure Container Apps handles orchestration.
services:
  server:
    build:
      context: .
      dockerfile: docker/DockerFile_server
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      LOG_TO_FILE: "false"
      GAME_DATA_ROOT: ./game-data
      END_MATCH_ON_NO_HUMANS: "true"
      MATCH_STATE_MERGE_ENABLED: "true"
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: docker/DockerFile_web_app
    ports:
      - "80:80"
    environment:
      # Set to the publicly accessible server address
      WS_HOST: "http://localhost:3000"
    restart: unless-stopped
    depends_on:
      - server
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run server:watch` starts without error (Ctrl+C after confirming startup)
- [ ] `npm run web:watch` starts without error (Ctrl+C after confirming startup)
- [ ] `docker build -f docker/Dockerfile_web_app -t card-game-frontend:test .` succeeds
- [ ] `docker build -f docker/Dockerfile_server -t card-game-server:test .` succeeds

#### Manual Verification:
- [ ] `docker compose -f docker-compose.prod.yml up --build` starts both containers cleanly
- [ ] Frontend is accessible at `http://localhost:80`
- [ ] Server is accessible at `http://localhost:3000`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Azure Infrastructure Provisioning

### Overview
Provision the Azure resources that CI/CD will deploy to. These are one-time manual steps using Azure CLI.

### Changes Required:

#### 2.1 Set Shell Variables

```bash
RESOURCE_GROUP="turkeysunite"
LOCATION="eastus"
ACR_NAME="turkeysunite"          # must be globally unique, lowercase, alphanumeric
CONTAINER_ENV="card-game-env"
SERVER_APP="card-game-server"
FRONTEND_APP="card-game-frontend"
```

#### 2.2 Create Azure Container Registry

```bash
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true
```

Get ACR credentials for GitHub Secrets:
```bash
az acr credential show --name $ACR_NAME
# Records: username and password
```

#### 2.3 Create Azure Container Apps Environment

```bash
az containerapp env create \
  --name $CONTAINER_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

#### 2.4 Create Service Principal for GitHub Actions

```bash
# Create service principal with Contributor role on resource group
az ad sp create-for-rbac \
  --name "card-game-cicd-sp" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP \
  --json-auth
```

This outputs a JSON blob — save it as the `AZURE_CREDENTIALS` GitHub Secret.

Also grant the service principal ACR push permissions:
```bash
SP_APP_ID=$(az ad sp list --display-name "card-game-cicd-sp" --query "[0].appId" -o tsv)
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
az role assignment create \
  --assignee $SP_APP_ID \
  --role AcrPush \
  --scope $ACR_ID
```

#### 2.5 Create Initial Container Apps (Server)

```bash
az containerapp create \
  --name $SERVER_APP \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_ENV \
  --image "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest" \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1 \
  --env-vars \
    PORT=3000 \
    LOG_TO_FILE=false \
    GAME_DATA_ROOT=./game-data \
    END_MATCH_ON_NO_HUMANS=true \
    MATCH_STATE_MERGE_ENABLED=true
```

Note the FQDN of the server app:
```bash
az containerapp show \
  --name $SERVER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.fqdn" -o tsv
# Example: card-game-server.someregion.azurecontainerapps.io
```

#### 2.6 Create Initial Container Apps (Frontend)

```bash
SERVER_FQDN=$(az containerapp show \
  --name $SERVER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.fqdn" -o tsv)

az containerapp create \
  --name $FRONTEND_APP \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_ENV \
  --image "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest" \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1 \
  --env-vars "WS_HOST=https://$SERVER_FQDN"
```

#### 2.7 Configure GitHub Secrets

In the GitHub repository settings under **Settings > Secrets and variables > Actions**, add:

| Secret Name | Value |
|---|---|
| `AZURE_CREDENTIALS` | JSON output from `az ad sp create-for-rbac --json-auth` |
| `ACR_LOGIN_SERVER` | `turkeysunite.azurecr.io` |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `AZURE_RESOURCE_GROUP` | `turkeysunite` |
| `AZURE_SERVER_APP_NAME` | `card-game-server` |
| `AZURE_FRONTEND_APP_NAME` | `card-game-frontend` |

### Success Criteria:

#### Automated Verification:
- [ ] `az group show --name $RESOURCE_GROUP` succeeds
- [ ] `az acr show --name $ACR_NAME` succeeds
- [ ] `az containerapp env show --name $CONTAINER_ENV --resource-group $RESOURCE_GROUP` succeeds
- [ ] `az containerapp show --name $SERVER_APP --resource-group $RESOURCE_GROUP` succeeds
- [ ] `az containerapp show --name $FRONTEND_APP --resource-group $RESOURCE_GROUP` succeeds

#### Manual Verification:
- [ ] All seven GitHub Secrets are set in the repository settings
- [ ] Both container apps show "Running" status in Azure portal

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: GitHub Actions — CI (Continuous Integration)

### Overview
Run lint, type-check, and tests on every push and pull request. Add missing frontend CI and server lint/type-check workflows.

### Changes Required:

#### 3.1 Add Frontend CI Workflow [x]

**File**: `.github/workflows/frontend-ci.yml` (new)

```yaml
name: Frontend CI

on:
  push:
    paths:
      - 'angular-frontend/**'
      - 'shared/**'
      - '.github/workflows/frontend-ci.yml'
  pull_request:
    paths:
      - 'angular-frontend/**'
      - 'shared/**'
      - '.github/workflows/frontend-ci.yml'

jobs:
  type-check:
    name: TypeScript Type Check
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: angular-frontend

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'yarn'
          cache-dependency-path: angular-frontend/yarn.lock

      - name: Install shared dependencies
        working-directory: shared
        run: yarn install

      - name: Install frontend dependencies
        run: yarn install --frozen-lockfile

      - name: Type check
        run: npx tsc -p tsconfig.app.json --noEmit
```

#### 3.2 Add Server Lint/Type-Check CI Workflow [x]

**File**: `.github/workflows/server-ci.yml` (new)

```yaml
name: Server CI

on:
  push:
    paths:
      - 'server/**'
      - 'shared/**'
      - '.github/workflows/server-ci.yml'
  pull_request:
    paths:
      - 'server/**'
      - 'shared/**'
      - '.github/workflows/server-ci.yml'

jobs:
  lint:
    name: Lint and Type Check
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: '2.7.7'

      - name: Install server dependencies
        run: deno install

      - name: Install shared dependencies
        working-directory: shared
        run: yarn install

      - name: Lint
        run: deno lint src/

      - name: Type check
        run: deno check --no-lock src/server.ts
```

#### 3.3 Update Existing Server Unit Test Workflow [x]

**File**: `.github/workflows/server-unit-tests.yml`
**Changes**: Update Deno version from `2.7.1` to `2.7.7` to match production Dockerfiles

```yaml
      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: '2.7.7'
```

### Success Criteria:

#### Automated Verification:
- [ ] Push a change touching `angular-frontend/**` — `Frontend CI` workflow triggers and passes
- [ ] Push a change touching `server/**` — `Server CI` and `Server Unit Tests` workflows trigger and pass
- [ ] Open a PR — all applicable workflows run as checks

---

## Phase 4: GitHub Actions — CD Build (Docker Images)

### Overview
On every push to `master`, build both Docker images and push them to Azure Container Registry.

### Changes Required:

#### 4.1 Add Build and Push Workflow

**File**: `.github/workflows/build-and-push.yml` (new)

```yaml
name: Build and Push Docker Images

on:
  push:
    branches:
      - master
    paths:
      - 'server/**'
      - 'shared/**'
      - 'angular-frontend/**'
      - 'docker/**'
      - '.github/workflows/build-and-push.yml'

jobs:
  build-server:
    name: Build Server Image
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Log in to Azure Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: ${{ secrets.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.ACR_LOGIN_SERVER }}/card-game-server
          tags: |
            type=sha,prefix=,format=short
            type=raw,value=latest

      - name: Build and push server image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/DockerFile_server
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  build-frontend:
    name: Build Frontend Image
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Log in to Azure Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: ${{ secrets.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.ACR_LOGIN_SERVER }}/card-game-frontend
          tags: |
            type=sha,prefix=,format=short
            type=raw,value=latest

      - name: Build and push frontend image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/DockerFile_web_app
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

### Success Criteria:

#### Automated Verification:
- [ ] Merge a change to `master` — `Build and Push Docker Images` workflow triggers
- [ ] Both `build-server` and `build-frontend` jobs succeed
- [ ] `az acr repository list --name turkeysunite` shows `card-game-server` and `card-game-frontend`
- [ ] `az acr repository show-tags --name turkeysunite --repository card-game-server` shows `latest` and a SHA tag

---

## Phase 5: GitHub Actions — CD Deploy (Azure Container Apps)

### Overview
After images are pushed to ACR, deploy the new revision to Azure Container Apps.

### Changes Required:

#### 5.1 Add Deploy Workflow

**File**: `.github/workflows/deploy.yml` (new)

```yaml
name: Deploy to Azure Container Apps

on:
  workflow_run:
    workflows: ["Build and Push Docker Images"]
    types:
      - completed
    branches:
      - master

jobs:
  deploy:
    name: Deploy to Azure Container Apps
    runs-on: ubuntu-latest
    # Only deploy on successful builds
    if: ${{ github.event.workflow_run.conclusion == 'success' }}

    steps:
      - name: Log in to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy server container app
        uses: azure/container-apps-deploy-action@v1
        with:
          resourceGroup: ${{ secrets.AZURE_RESOURCE_GROUP }}
          containerAppName: ${{ secrets.AZURE_SERVER_APP_NAME }}
          imageToDeploy: ${{ secrets.ACR_LOGIN_SERVER }}/card-game-server:latest
          registryUrl: ${{ secrets.ACR_LOGIN_SERVER }}
          registryUsername: ${{ secrets.ACR_USERNAME }}
          registryPassword: ${{ secrets.ACR_PASSWORD }}

      - name: Deploy frontend container app
        uses: azure/container-apps-deploy-action@v1
        with:
          resourceGroup: ${{ secrets.AZURE_RESOURCE_GROUP }}
          containerAppName: ${{ secrets.AZURE_FRONTEND_APP_NAME }}
          imageToDeploy: ${{ secrets.ACR_LOGIN_SERVER }}/card-game-frontend:latest
          registryUrl: ${{ secrets.ACR_LOGIN_SERVER }}
          registryUsername: ${{ secrets.ACR_USERNAME }}
          registryPassword: ${{ secrets.ACR_PASSWORD }}

      - name: Verify server deployment
        run: |
          az containerapp show \
            --name ${{ secrets.AZURE_SERVER_APP_NAME }} \
            --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
            --query "properties.latestRevisionName" -o tsv

      - name: Verify frontend deployment
        run: |
          az containerapp show \
            --name ${{ secrets.AZURE_FRONTEND_APP_NAME }} \
            --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
            --query "properties.latestRevisionName" -o tsv
```

### WebSocket / Session Affinity Note

Azure Container Apps supports WebSocket connections natively. If the server app scales beyond 1 replica, session affinity must be enabled:

```bash
az containerapp ingress sticky-sessions set \
  --name card-game-server \
  --resource-group turkeysunite \
  --affinity sticky
```

### Success Criteria:

#### Automated Verification:
- [ ] Push to master, confirm `Build and Push` succeeds, then confirm `Deploy` workflow triggers
- [ ] `az containerapp show --name card-game-server --resource-group turkeysunite --query "properties.latestRevisionName"` returns new revision name
- [ ] `az containerapp show --name card-game-frontend --resource-group turkeysunite --query "properties.latestRevisionName"` returns new revision name

#### Manual Verification:
- [ ] Visit the frontend Container App FQDN in a browser — UI loads
- [ ] Open the game and verify WebSocket connection to the server succeeds (can create a lobby)
- [ ] Check Azure portal Container Apps > Revisions for both apps — new revisions are active

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## File Summary

### New Files

| File | Purpose |
|---|---|
| `docker-compose.prod.yml` | Local production compose reference |
| `.github/workflows/frontend-ci.yml` | Frontend type-check CI |
| `.github/workflows/server-ci.yml` | Server lint + type-check CI |
| `.github/workflows/build-and-push.yml` | Docker build + ACR push on master |
| `.github/workflows/deploy.yml` | Azure Container Apps deployment |

### Modified Files

| File | Change |
|---|---|
| `package.json` | Fix `watch` script name mismatch |
| `docker/Dockerfile_web_app` | Update to Node 24 |
| `docker/Dockerfile_dev_frontend` | Update to Node 24 |
| `.github/workflows/server-unit-tests.yml` | Update Deno version to 2.7.7 |

---

## Rollback Strategy

Azure Container Apps maintains revision history. To roll back to a previous revision:

```bash
# List all revisions
az containerapp revision list \
  --name card-game-server \
  --resource-group turkeysunite \
  --query "[].{name:name,active:properties.active,created:properties.createdTime}" \
  --output table

# Activate a previous revision (replaces active)
az containerapp revision activate \
  --revision <previous-revision-name> \
  --resource-group turkeysunite
```
