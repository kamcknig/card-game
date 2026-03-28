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

### Current Frontend Environment Variables

| Variable | Description |
|----------|-------------|
| `WS_HOST` | Full URL to the server Container App (e.g. `https://dominion-clone-server.<region>.azurecontainerapps.io`) |

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
