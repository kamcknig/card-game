# Azure Operations Guide

This document covers day-to-day operations for the Azure-hosted production environment. For architecture overview and CI/CD pipeline details, see the root [README.md](../README.md#production-deployment-azure).

## Azure Resources

All resources live in the `turkeysunite` resource group in the East US region.

| Resource | Name | Purpose |
|----------|------|---------|
| Container Registry (ACR) | `turkeysunite` | Stores Docker images (`turkeysunite.azurecr.io`) |
| Container Apps Environment | `dominion-clone-env` | Shared networking layer |
| Container App | `dominion-clone-server` | Deno game server (port 3000) |
| Container App | `dominion-clone-frontend` | nginx + Angular SPA (port 80) |

## Viewing App Status

### Azure Portal

1. Go to **Container Apps** > select your app (e.g. `dominion-clone-server`)
2. **Overview** page shows running status, FQDN, and resource usage
3. **Application > Revisions and replicas** — shows all revisions, which is active, traffic weight, and creation time
4. **Application > Log stream** — live container stdout/stderr logs
5. **Monitoring > Logs** — query historical logs via Log Analytics

### Azure CLI

```bash
# Check running status
az containerapp show \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --query "{status:properties.runningStatus,revision:properties.latestRevisionName,fqdn:properties.configuration.ingress.fqdn}" \
  -o table

# List all revisions with status
az containerapp revision list \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --query "[].{name:name,active:properties.active,trafficWeight:properties.trafficWeight,created:properties.createdTime,state:properties.runningState}" \
  -o table

# View container logs
az containerapp logs show \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --follow
```

## Updating Containers

### Automatic (CI/CD)

Merging to `master` triggers the full pipeline automatically:
1. **Build and Push** builds Docker images and pushes them to ACR with a short-SHA tag and `latest`
2. **Deploy** pulls the SHA-tagged image and updates each Container App, creating a new revision

Each deploy uses a unique commit SHA tag (not `latest`) so Azure always creates a new revision. See `.github/workflows/deploy.yml` for details.

### Manual Update

To deploy a specific image version outside of the CI/CD pipeline:

```bash
# List available tags in ACR
az acr repository show-tags --name turkeysunite --repository dominion-clone-server --orderby time_desc -o table
az acr repository show-tags --name turkeysunite --repository dominion-clone-frontend --orderby time_desc -o table

# Update server to a specific SHA tag
az containerapp update \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --image turkeysunite.azurecr.io/dominion-clone-server:<sha-tag>

# Update frontend to a specific SHA tag
az containerapp update \
  --name dominion-clone-frontend \
  --resource-group turkeysunite \
  --image turkeysunite.azurecr.io/dominion-clone-frontend:<sha-tag>
```

New revisions typically take 30-60 seconds to start serving traffic.

**Important:** Do not deploy with the `:latest` tag. Azure Container Apps only creates a new revision when the image reference string changes. Since `:latest` is always the same string, Azure skips the update. Always use a SHA tag or other unique identifier.

## Environment Variables

### Setting Environment Variables

```bash
# Set a plain-text environment variable (creates a new revision)
az containerapp update \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --set-env-vars KEY=value

# Set multiple variables at once
az containerapp update \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --set-env-vars KEY1=value1 KEY2=value2

# Remove an environment variable
az containerapp update \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --remove-env-vars KEY
```

### Using Secrets for Sensitive Values

For passwords and other sensitive values, use Azure Container Apps secrets instead of plain-text env vars. Secrets are encrypted at rest and hidden in the Azure Portal.

```bash
# Create a secret
az containerapp secret set \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --secrets my-secret=secretvalue

# Reference the secret in an environment variable
az containerapp update \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --set-env-vars MY_VAR=secretref:my-secret

# List secrets (values are hidden)
az containerapp secret list \
  --name dominion-clone-server \
  --resource-group turkeysunite

# Remove a secret (must remove referencing env vars first)
az containerapp secret remove \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --secret-names my-secret
```

### Current Server Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server listen port (3000 in production) |
| `LOG_TO_FILE` | Disable file logging in container (`false`) |
| `GAME_DATA_ROOT` | Game data directory (`./game-data`) |
| `END_MATCH_ON_NO_HUMANS` | End matches when all humans leave (`true`) |
| `MATCH_STATE_MERGE_ENABLED` | Enable match state merging (`true`) |
| `AUTH_PASSWORD` | Preset password for simple authentication (use secrets for this) |
| `AUTH_DISABLED` | Set to `true` to skip password checks entirely — **development only**, never set in production. Defaults to `false`. |
| `AUTH_ALLOWED_ORIGINS` | Comma-separated list of origins allowed by CORS on `/auth/*` endpoints. Use `*` for any origin (dev only). Example: `https://dominion-clone-frontend.azurecontainerapps.io` |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | Maximum failed login attempts from a single IP within the rate-limit window before returning 429. Default: `10`. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Duration (milliseconds) of the sliding window used by the login rate limiter. Default: `60000` (1 minute). |
| `AUTH_MAX_BODY_BYTES` | Maximum request body size (bytes) accepted on `/auth/login`. Requests exceeding this are rejected with 413. Default: `4096`. |
| `AUTH_SESSION_TTL_MS` | Session time-to-live in milliseconds (sliding window). Each validated token has its expiry extended by this amount. Default: `604800000` (7 days). |
| `AUTH_SESSION_STORE` | Session storage backend. `memory` (default) loses sessions on restart. `kv` uses Deno KV with a write-through cache backed by `AUTH_KV_PATH`. Set to `kv` in production for restart persistence. |
| `AUTH_KV_PATH` | Filesystem path to the Deno KV store file used when `AUTH_SESSION_STORE=kv`. Default: `./game-data/auth.kv`. Mount an Azure Files share at the containing directory for durable persistence across container revisions. Use `':memory:'` for dev/test (not persisted). |

### Current Frontend Environment Variables

| Variable | Description |
|----------|-------------|
| `WS_HOST` | Full URL to the server Container App (e.g. `https://dominion-clone-server.<region>.azurecontainerapps.io`). Also drives the CSP `connect-src` directive — see [Content Security Policy](#content-security-policy) below. |

## Session Persistence

The Deno KV backend is the only persistent session storage option. It requires a
mounted volume to survive container revisions on Azure Container Apps.

### Deno KV (`AUTH_SESSION_STORE=kv`)

When `AUTH_SESSION_STORE=kv`, session data is written to the Deno KV store at
`AUTH_KV_PATH` (default `./game-data/auth.kv`). Deno KV uses a write-through
in-memory cache so reads are always synchronous and fast. The backing file must
survive container restarts for sessions to persist.

### Using Azure Files for Durable Session Storage

Mount an Azure Files share at the `game-data` directory so the KV store file
persists across revisions and restarts.

```bash
# Create a storage account and file share (one-time setup)
az storage account create \
  --name dominionstorage \
  --resource-group turkeysunite \
  --sku Standard_LRS

az storage share create \
  --account-name dominionstorage \
  --name dominion-game-data

# Store the storage key as a Container Apps secret
STORAGE_KEY=$(az storage account keys list \
  --account-name dominionstorage \
  --resource-group turkeysunite \
  --query "[0].value" -o tsv)

az containerapp secret set \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --secrets storage-key="$STORAGE_KEY"

# Mount the Azure Files share into the container
az containerapp update \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --storage-name dominion-game-data \
  --storage-account dominionstorage \
  --storage-account-key secretref:storage-key \
  --storage-share dominion-game-data \
  --storage-mount-path /app/server/game-data \
  --set-env-vars AUTH_SESSION_STORE=kv AUTH_KV_PATH=/app/server/game-data/auth.kv
```

### Backup Considerations

- The KV store file (`auth.kv`) is self-contained — copy it to back up all sessions.
- To rotate the auth store (force all users to re-login), delete the store file and restart.
- Sessions only contain auth metadata (token, username, IP, timestamps). No game state
  is stored here.

## Content Security Policy

The Nginx frontend container sends a `Content-Security-Policy` header (and companion security headers) on every response. The policy is generated dynamically by `docker/env.sh` at container start so the `connect-src` directive can include the runtime `WS_HOST` value without rebuilding the image.

### How it works

`docker/env.sh` writes `/etc/nginx/conf.d/security-headers.conf` during container initialisation. `docker/nginx.conf` includes that file in the `server` block via:

```nginx
include /etc/nginx/conf.d/security-headers.conf;
```

The generated file contains:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' <WS_HOST> <WS_CONNECT_SRC>; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

where `<WS_HOST>` is the value of the `WS_HOST` environment variable and `<WS_CONNECT_SRC>` is its WebSocket equivalent (`http://` → `ws://`, `https://` → `wss://`).

### No additional environment variables required

The CSP is derived entirely from `WS_HOST`. No new env vars need to be set. Ensure `WS_HOST` is set correctly in the frontend Container App (it must already be set for Socket.IO to work).

### Known concession: `style-src 'unsafe-inline'`

Angular injects component styles as `<style>` tags at runtime, which requires `'unsafe-inline'` in `style-src`. Eliminating it would require per-request nonces threaded through Nginx, which is considerably more complex. CSS-based XSS is far harder to exploit than script injection, so this risk is accepted for now. If a nonce-based approach is introduced in the future, remove `'unsafe-inline'` from `style-src` and add nonce injection to `env.sh` and the Nginx configuration.

### Verifying headers in production

```bash
# Inspect security headers from the Nginx container
curl -si https://<frontend-fqdn>/index.html | grep -i "content-security\|x-content-type\|referrer\|permissions"
```

## Rollback

Azure Container Apps maintains revision history. Each deploy creates a new immutable revision.

```bash
# List all revisions
az containerapp revision list \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --query "[].{name:name,active:properties.active,created:properties.createdTime}" \
  -o table

# Activate a previous revision (deactivates the current one)
az containerapp revision activate \
  --revision <previous-revision-name> \
  --resource-group turkeysunite
```

## Scaling

Both apps currently run with 1 replica (`--min-replicas 1 --max-replicas 1`).

```bash
# Scale up (e.g. 1-3 replicas)
az containerapp update \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --min-replicas 1 \
  --max-replicas 3
```

**Important:** If the server scales beyond 1 replica, session affinity must be enabled for Socket.IO sticky sessions:

```bash
az containerapp ingress sticky-sessions set \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --affinity sticky
```

## ACR Image Management

```bash
# List repositories
az acr repository list --name turkeysunite -o table

# List tags for a repository (newest first)
az acr repository show-tags --name turkeysunite --repository dominion-clone-server --orderby time_desc -o table

# Delete an old tag
az acr repository untag --name turkeysunite --image dominion-clone-server:<tag>

# Delete untagged manifests (cleanup)
az acr run --cmd "acr purge --filter 'dominion-clone-server:.*' --untagged --ago 30d" --registry turkeysunite /dev/null
```

## GitHub Secrets

The CI/CD pipeline requires these secrets in the GitHub repository settings (**Settings > Secrets and variables > Actions**):

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Service principal JSON from `az ad sp create-for-rbac --json-auth` |
| `ACR_LOGIN_SERVER` | `turkeysunite.azurecr.io` |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `AZURE_RESOURCE_GROUP` | `turkeysunite` |
| `AZURE_SERVER_APP_NAME` | `dominion-clone-server` |
| `AZURE_FRONTEND_APP_NAME` | `dominion-clone-frontend` |

To rotate the service principal credentials:

```bash
# Reset credentials
az ad sp credential reset --id <sp-app-id>

# Update the AZURE_CREDENTIALS GitHub secret with the new JSON output
```

## Troubleshooting

### Container won't start / revision stuck in "Provisioning"

```bash
# Check system logs for startup errors
az containerapp logs show \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --type system

# Check container logs
az containerapp logs show \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --type console
```

### Deploy workflow succeeded but old version still running

This happens when deploying with the `:latest` tag (same image reference string = no new revision). The deploy workflow uses SHA tags to avoid this. For manual updates, always use a specific SHA tag.

### WebSocket connection fails

- Verify the frontend's `WS_HOST` env var points to the server's FQDN with `https://`
- Azure Container Apps supports WebSocket natively; no special config needed for 1 replica
- For >1 replica, ensure sticky sessions are enabled (see [Scaling](#scaling))
