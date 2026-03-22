---
date: 2026-03-26
git_commit: d29d0c7b
branch: cicd
repository: kamcknig/card-game
topic: CI/CD pipeline using GitHub Actions and Azure Container Apps
tags: [ci-cd, github-actions, azure, docker, container-apps, acr]
status: draft
---

# CI/CD Plan: GitHub Actions + Azure Container Apps

## Overview

This plan establishes a full CI/CD pipeline for the card-game monorepo using **GitHub Actions** for automation and **Microsoft Azure** for production hosting. The pipeline covers:

- Continuous integration (lint, type-check, test) on every push and PR
- Docker image build and push to **Azure Container Registry (ACR)** on merge to `master`
- Automated deployment to **Azure Container Apps** after a successful image push

### Architecture Summary

```
GitHub Repo
  ├── CI (push/PR) → lint + type-check + unit tests
  └── CD (master merge)
        ├── Build & push server image  → ACR
        ├── Build & push frontend image → ACR
        └── Deploy both images         → Azure Container Apps
```

### Azure Services Used

| Service | Purpose |
|---|---|
| Azure Container Registry (ACR) | Store Docker images |
| Azure Container Apps Environment | Shared networking for containers |
| Azure Container App: `card-game-server` | Runs Deno game server |
| Azure Container App: `card-game-frontend` | Runs nginx frontend |

---

## Pre-Implementation Notes

### Known Issues to Fix in Phase 1

1. **Root `package.json` watch script mismatch**: defines `server:watch` / `web:watch` but `watch` calls `watch:server` / `watch:web`.
2. **No production Docker Compose**: No `docker-compose.yml` for production orchestration. A `docker-compose.prod.yml` should be added for reference and local production testing.

---

## Phase 1: Fix Pre-Existing Build Issues

**Goal**: Resolve known build inconsistencies before building CI/CD around them.

### 1.1 Fix Root `package.json` Watch Script

**File**: `package.json`

Current (broken):
```json
{
  "scripts": {
    "watch": "concurrently \"npm:watch:server\" \"npm:watch:web\"",
    "server:watch": "cd server && deno task dev:watch",
    "web:watch": "cd angular-frontend && npm run start"
  }
}
```

Fixed:
```json
{
  "scripts": {
    "watch": "concurrently \"npm:server:watch\" \"npm:web:watch\"",
    "server:watch": "cd server && deno task dev:watch",
    "web:watch": "cd angular-frontend && npm run start"
  }
}
```

### 1.2 Add Production Docker Compose

**File**: `docker-compose.prod.yml` (new file at repo root)

```yaml
# Production Docker Compose — for local production testing and reference.
# In production, Azure Container Apps handles orchestration.
services:
  server:
    build:
      context: .
      dockerfile: docker/Dockerfile_server
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
      dockerfile: docker/Dockerfile_web_app
    ports:
      - "80:80"
    environment:
      # Set to the publicly accessible server address
      WS_HOST: "http://localhost:3000"
    restart: unless-stopped
    depends_on:
      - server
```

### Verification

```bash
# Verify root watch script works
npm run server:watch &
npm run web:watch &

# Verify production frontend Docker build
docker build -f docker/Dockerfile_web_app -t card-game-frontend:test .

# Verify production compose starts cleanly
docker compose -f docker-compose.prod.yml up --build
```

---

## Phase 2: Azure Infrastructure Provisioning

**Goal**: Provision the Azure resources that CI/CD will deploy to. These steps are one-time manual setup using Azure CLI.

### Prerequisites

- Azure CLI installed and logged in (`az login`)
- Azure subscription available

### 2.1 Set Shell Variables

```bash
RESOURCE_GROUP="turkeysunite"
LOCATION="eastus"
ACR_NAME="cardgameacr"           # must be globally unique, lowercase, alphanumeric
CONTAINER_ENV="card-game-env"
SERVER_APP="card-game-server"
FRONTEND_APP="card-game-frontend"
```

### 2.2 Create Resource Group

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

### 2.3 Create Azure Container Registry

```bash
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true
```

Note the login server: `$ACR_NAME.azurecr.io`

Get ACR credentials for GitHub Secrets:
```bash
az acr credential show --name $ACR_NAME
# Records: username and password
```

### 2.4 Create Azure Container Apps Environment

```bash
az containerapp env create \
  --name $CONTAINER_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

### 2.5 Create Service Principal for GitHub Actions

GitHub Actions needs Azure credentials to push images and deploy containers.

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

### 2.6 Create Initial Container Apps (Server)

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

Note the FQDN of the server app after creation:
```bash
az containerapp show \
  --name $SERVER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.fqdn" -o tsv
# Example: card-game-server.someregion.azurecontainerapps.io
```

### 2.7 Create Initial Container Apps (Frontend)

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

### 2.8 Configure GitHub Secrets

In the GitHub repository settings under **Settings → Secrets and variables → Actions**, add:

| Secret Name | Value |
|---|---|
| `AZURE_CREDENTIALS` | JSON output from `az ad sp create-for-rbac --json-auth` |
| `ACR_LOGIN_SERVER` | `$ACR_NAME.azurecr.io` |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `AZURE_RESOURCE_GROUP` | `turkeysunite` |
| `AZURE_SERVER_APP_NAME` | `card-game-server` |
| `AZURE_FRONTEND_APP_NAME` | `card-game-frontend` |

### Verification

```bash
# Confirm resource group exists
az group show --name $RESOURCE_GROUP

# Confirm ACR exists
az acr show --name $ACR_NAME

# Confirm Container Apps environment exists
az containerapp env show --name $CONTAINER_ENV --resource-group $RESOURCE_GROUP

# Confirm container apps exist
az containerapp show --name $SERVER_APP --resource-group $RESOURCE_GROUP
az containerapp show --name $FRONTEND_APP --resource-group $RESOURCE_GROUP
```

---

## Phase 3: GitHub Actions — CI (Continuous Integration)

**Goal**: Run lint, type-check, and tests on every push and pull request.

### 3.1 Add Frontend CI Workflow

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
          node-version: '20'
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

### 3.2 Add Server Lint/Format CI Workflow

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
    name: Lint
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

### 3.3 Update Existing Server Unit Test Workflow

**File**: `.github/workflows/server-unit-tests.yml`

Update the Deno version from `2.7.1` to `2.7.7` to match production:

```yaml
      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: '2.7.7'
```

### Verification

- Push a change to `angular-frontend/**` and confirm the `Frontend CI` workflow runs and passes.
- Push a change to `server/**` and confirm `Server CI` and `Server Unit Tests` both run.
- Open a PR and verify all three workflows are required checks.

---

## Phase 4: GitHub Actions — CD Build (Docker Images)

**Goal**: On every push to `master`, build both Docker images and push them to ACR.

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
    outputs:
      image-tag: ${{ steps.meta.outputs.version }}

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
          file: docker/Dockerfile_server
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  build-frontend:
    name: Build Frontend Image
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.version }}

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
          file: docker/Dockerfile_web_app
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

### Verification

- Merge a change to `master` (or push directly) and confirm the workflow runs.
- In Azure portal or CLI, verify images appear in ACR:
  ```bash
  az acr repository list --name $ACR_NAME
  az acr repository show-tags --name $ACR_NAME --repository card-game-server
  az acr repository show-tags --name $ACR_NAME --repository card-game-frontend
  ```

---

## Phase 5: GitHub Actions — CD Deploy (Azure Container Apps)

**Goal**: After images are pushed to ACR, deploy the new revision to Azure Container Apps.

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

Azure Container Apps uses sticky sessions for WebSocket connections. If the server app scales beyond 1 replica, session affinity must be enabled:

```bash
az containerapp ingress update \
  --name $SERVER_APP \
  --resource-group $RESOURCE_GROUP \
  --sticky-sessions true
```

This should be done as part of Phase 2 if scale > 1 is ever expected.

### Verification

- Push to master, confirm `Build and Push` succeeds, then confirm `Deploy` workflow triggers.
- Visit the Container Apps frontend FQDN in a browser; verify the UI loads.
- Open the game and verify WebSocket connection to the server succeeds.
- Check Azure portal under Container Apps → Revisions for both apps to confirm new revisions are active.

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
| `.github/workflows/server-unit-tests.yml` | Update Deno version to 2.7.7 |

---

## Rollback Strategy

Azure Container Apps maintains revision history. To roll back to a previous revision:

```bash
# List all revisions
az containerapp revision list \
  --name $SERVER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "[].{name:name,active:properties.active,created:properties.createdTime}" \
  --output table

# Activate a previous revision (replaces active)
az containerapp revision activate \
  --revision <previous-revision-name> \
  --resource-group $RESOURCE_GROUP
```

---

## Success Criteria

### Automated

- [ ] `Frontend CI` workflow passes on push to `angular-frontend/**`
- [ ] `Server CI` workflow passes on push to `server/**`
- [ ] `Server Unit Tests` workflow passes on push to `server/**`
- [ ] `Build and Push` workflow pushes both images to ACR on merge to master
- [ ] `Deploy` workflow updates both container apps after successful build

### Manual

- [ ] Frontend loads at the Container Apps FQDN in a browser
- [ ] WebSocket game connection works end-to-end (can start a match)
- [ ] Rolling back to a previous revision via Azure CLI works
- [ ] `docker compose -f docker-compose.prod.yml up --build` runs locally without errors
