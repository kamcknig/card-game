# Azure Operations Guide

This document covers day-to-day operations for the Azure-hosted production environment. For architecture overview and CI/CD pipeline details, see the root [README.md](../README.md#production-deployment-azure).

## Azure Resources

All resources live in the `turkeysunite` resource group in the East US region.

| Resource | Name | Purpose |
|----------|------|---------|
| Container Registry (ACR) | `turkeysunite` | Stores Docker images (`turkeysunite.azurecr.io`) |
| Storage Account | `turkeysunite` | Azure Files share for persistent game data |
| Azure Files Share | `dominion-game-data` | Mounted into server container at `/app/server/game-data` |
| Container Apps Environment | `dominion-clone-env` | Shared networking layer |
| Container App | `dominion-clone-server` | Deno game server (port 3000) |
| Container App | `dominion-clone-frontend` | nginx + Angular SPA (port 80) |

## Viewing App Status

### Azure Portal

1. Search for **Container Apps** in the top search bar (or find it in your starred favorites in the left sidebar)
2. Select your app (e.g. `dominion-clone-server`)
3. **Overview** page shows running status, FQDN, and resource usage
4. **Application > Revisions and replicas** — shows all revisions, which is active, traffic weight, and creation time
5. **Monitoring > Log stream** — live container stdout/stderr logs
6. **Monitoring > Logs** — query historical logs via Log Analytics
7. **Application > Containers** — shows the running image reference including the tag

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

Merging to master triggers the full pipeline automatically:
1. **Build and Push** builds Docker images and pushes them to ACR tagged with the short commit SHA and `latest`
2. **Deploy** pulls the SHA-tagged image, updates each Container App creating a new revision, then rebinds the custom domain

Each deploy uses a unique SHA tag (not `latest`) so Azure always creates a new revision. See `.github/workflows/deploy.yml` for details.

### Manual Update

To deploy a specific image version outside of the CI/CD pipeline:

```bash
# List available tags in ACR
az acr repository show-tags --name turkeysunite --repository dominion-clone-server --orderby time_desc -o table
az acr repository show-tags --name turkeysunite --repository dominion-clone-frontend --orderby time_desc -o table

# Update server to a specific tag
az containerapp update \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --image turkeysunite.azurecr.io/dominion-clone-server:<tag>

# Update frontend to a specific tag
az containerapp update \
  --name dominion-clone-frontend \
  --resource-group turkeysunite \
  --image turkeysunite.azurecr.io/dominion-clone-frontend:<tag>
```

New revisions typically take 30-60 seconds to start serving traffic.

**Important:** Do not deploy with the `:latest` tag. Azure Container Apps only creates a new revision when the image reference string changes. Since `:latest` is always the same string, Azure skips the update. Always use a specific tag (e.g., a short SHA).

## Custom Domain

The frontend is accessible at `https://dominion.turkeysunite.com` via a DNS CNAME pointing to `dominion-clone-frontend.happyglacier-53482b33.eastus.azurecontainerapps.io`.

**Known issue:** The `azure/container-apps-deploy-action` clears the custom domain binding when it creates a new revision. The deploy workflow automatically rebinds it after each deploy via `az containerapp hostname bind`. If the site becomes unreachable after a deploy with `ERR_CONNECTION_RESET`, the custom domain binding was lost — run this to restore it:

```bash
az containerapp hostname bind \
  --name dominion-clone-frontend \
  --resource-group turkeysunite \
  --hostname dominion.turkeysunite.com \
  --environment dominion-clone-env \
  --validation-method CNAME
```

This uses the existing CNAME record to validate ownership and provisions a managed certificate automatically.

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
| `AUTH_ALLOWED_ORIGINS` | Comma-separated list of origins allowed by CORS on `/auth/*` endpoints. Set to the custom domain in production: `https://dominion.turkeysunite.com`. Use `*` for any origin (dev only). |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | Maximum failed login attempts from a single IP within the rate-limit window before returning 429. Default: `10`. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Duration (milliseconds) of the sliding window used by the login rate limiter. Default: `60000` (1 minute). |
| `AUTH_MAX_BODY_BYTES` | Maximum request body size (bytes) accepted on `/auth/login`. Requests exceeding this are rejected with 413. Default: `4096`. |
| `AUTH_SESSION_TTL_MS` | Session time-to-live in milliseconds (sliding window). Each validated token has its expiry extended by this amount. Default: `604800000` (7 days). |
| `STORAGE_BACKEND` | Unified storage backend — drives both auth (sessions, users, registration codes) and game data (match-configuration saves). Allowed values: `kv` (Deno KV with a write-through cache, backed by Azure Files) or `supabase` (Postgres tables in a Supabase project). When unset or invalid the server still boots and `/status` reports a `STORAGE_BACKEND_INVALID` error issue (the frontend shows this on `/server-status`) — set this var on every revision. |
| `AUTH_KV_PATH` | Filesystem path to the Deno KV auth store file used when `STORAGE_BACKEND=kv`. Set to `/app/server/game-data/auth.kv` in production (matches the Azure Files mount path). |
| `GAME_DATA_KV_PATH` | Filesystem path to the Deno KV game-data store file used when `STORAGE_BACKEND=kv`. Set to `/app/server/game-data/game-data.kv` in production. |
| `SUPABASE_URL` | Supabase project URL. Required when `STORAGE_BACKEND=supabase`. Stored as a plain env var (it is not secret). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key. Required when `STORAGE_BACKEND=supabase`. **Always** set this as a Container Apps secret (`secretref:supabase-service-role-key`), never a plain env var — it bypasses RLS and grants full DB access. |
| `AUTH_LOCKOUT_THRESHOLD` | Consecutive failed logins before a user account is locked (per-account, independent of the IP rate limiter). Default: `5`. |
| `AUTH_LOCKOUT_DURATION_MS` | Lockout duration (milliseconds) once the per-account threshold is exceeded. Default: `600000` (10 minutes). |
| `AUTH_MIN_PASSWORD_LENGTH` | Minimum password length enforced at registration and password-change. Default: `10`. |

### Current Frontend Environment Variables

| Variable | Description |
|----------|-------------|
| `WS_HOST` | Full URL to the server Container App (e.g. `https://dominion-clone-server.happyglacier-53482b33.eastus.azurecontainerapps.io`). Also drives the CSP `connect-src` directive — see [Content Security Policy](#content-security-policy) below. |

## Initial Account Bootstrap

The server requires at least one user account to exist before players can log in. Since the KV store is backed by Azure Files, the bootstrap process creates the `auth.kv` file locally and uploads it to the share before the server starts.

**Important:** stop the running server before invoking either script. The server primes an in-memory cache of the KV state at startup, so writes made while the server is running will not be visible to the running process and can also cause SQLite lock contention on the shared `auth.kv` file. See [server/README.md](../server/README.md#authentication-usage) for the full HTTP endpoint reference and bootstrap workflow.

### Creating the first user

Run locally to create the KV file, then upload it to Azure Files:

```bash
# Create the KV file locally
cd server
deno task auth:users create --username <name> --password <pw> --kv ./game-data/auth.kv

# Get the storage key
STORAGE_KEY=$(az storage account keys list \
  --account-name turkeysunite \
  --resource-group turkeysunite \
  --query "[0].value" -o tsv)

# Upload auth.kv to the Azure Files share
az storage file upload \
  --account-name turkeysunite \
  --share-name dominion-game-data \
  --source ./game-data/auth.kv \
  --path auth.kv \
  --account-key "$STORAGE_KEY"
```

Restart the server container so it picks up the file on startup. Usernames must be 3–32 characters, alphanumeric or underscore. The `create` subcommand refuses to overwrite an existing username. Other `auth:users` subcommands: `delete`, `set-password`, `clear` (run any subcommand with `--help` for its options).

### Creating registration codes for additional users

Once a user exists and can log in, they can create registration codes via the API (`POST /auth/registration-codes`) — this is the preferred path because the running server's in-memory cache picks them up immediately. For offline/operator use with the server stopped:

```bash
cd server
deno task auth:create-reg-code --expires-in 24h --max-uses 1 --created-by <your-username> --kv /path/to/auth.kv
# Duration strings: 30s, 10m, 24h, 7d
```

The script prints the generated code to stdout. Share it securely; anyone with the code can register an account at `POST /auth/register`.

## Game Data KV Bootstrap

The server opens a separate `game-data.kv` Deno KV store (independent from `auth.kv`) for game-data persistence such as per-user match configuration saves. Like the auth store, it lives on the Azure Files share at `dominion-game-data/game-data.kv`, mounted into the container at `/app/server/game-data/game-data.kv`.

**Important:** this file must be bootstrapped locally and uploaded before the server can start in any environment that does not already have it on the share. `Deno.openKv()` cannot reliably *create* a new SQLite database on Azure Files SMB — the byte-range locks SQLite uses during header initialization don't behave correctly on SMB, producing `Error: database is locked` at startup. Opening an *existing* valid SQLite file works fine, so this bootstrap is a one-time-per-environment task. (This is the same reason `auth.kv` is bootstrapped via local create + upload.)

### Bootstrapping the file

```bash
# Create an initialized empty Deno KV file locally
deno eval --unstable-kv "const kv = await Deno.openKv('/tmp/game-data.kv'); kv.close();"

# Verify it has a real SQLite header (~36 KB, starting with "SQLite format 3")
head -c 16 /tmp/game-data.kv | xxd

# Get the storage key
STORAGE_KEY=$(az storage account keys list \
  --account-name turkeysunite \
  --resource-group turkeysunite \
  --query "[0].value" -o tsv)

# Upload to the Azure Files share
az storage file upload \
  --account-name turkeysunite \
  --share-name dominion-game-data \
  --source /tmp/game-data.kv \
  --path game-data.kv \
  --account-key "$STORAGE_KEY"
```

Restart the server container after upload (`az containerapp revision restart ...`) so the next startup attempt picks up the file. See [Server fails to start with `Error: database is locked`](#server-fails-to-start-with-error-database-is-locked) under Troubleshooting if a previous startup left behind a 0-byte stub.

## Storage Persistence

The server supports two persistent storage backends, selected via `STORAGE_BACKEND`. Both drive auth (sessions, users, registration codes) and game data (match-configuration saves) together — splitting them is not supported.

### Deno KV (`STORAGE_BACKEND=kv`)

When `STORAGE_BACKEND=kv`, all state is written to two Deno KV files at `AUTH_KV_PATH` and `GAME_DATA_KV_PATH`. Each store uses a write-through in-memory cache so reads are always synchronous and fast. The backing files must survive container restarts for sessions and saved configurations to persist — on Azure Container Apps this requires a mounted Azure Files volume (see _Azure Files Setup_ below). The bootstrap workflow for the KV files is documented in [_Initial Account Bootstrap_](#initial-account-bootstrap) and [_Game Data KV Bootstrap_](#game-data-kv-bootstrap) above.

### Supabase (`STORAGE_BACKEND=supabase`)

When `STORAGE_BACKEND=supabase`, the server reads and writes Postgres tables in a Supabase project (`auth_users`, `auth_sessions`, `auth_registration_codes`, `match_configuration_saves`). The same write-through cache pattern is used — only the persistence layer changes. No volume mount is required because state lives in Supabase. Required env vars: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the service-role key must be a Container Apps secret).

Apply the schema once with `supabase db push` against the migration file in `supabase/migrations/`. To migrate an existing KV deployment to Supabase, run `deno task migrate-kv-to-supabase` from a host that can reach both the KV files and the Supabase project — see [server/README.md § Migrating from KV to Supabase](../server/README.md#migrating-from-kv-to-supabase).

If the Supabase project is unreachable at startup, the server still boots and the `/status` endpoint reports an `error`-level `SUPABASE_OPEN_FAILED` issue; the frontend redirects to `/server-status` so users see the failure rather than a blank screen.

### Azure Files Setup (one-time)

The Azure Files share is already provisioned. These steps are for reference if it ever needs to be recreated.

```bash
# Get the storage key
STORAGE_KEY=$(az storage account keys list \
  --account-name turkeysunite \
  --resource-group turkeysunite \
  --query "[0].value" -o tsv)

# Create the file share
az storage share create \
  --account-name turkeysunite \
  --name dominion-game-data \
  --account-key "$STORAGE_KEY"

# Register the share with the Container Apps Environment
az containerapp env storage set \
  --name dominion-clone-env \
  --resource-group turkeysunite \
  --storage-name dominion-game-data \
  --azure-file-account-name turkeysunite \
  --azure-file-account-key "$STORAGE_KEY" \
  --azure-file-share-name dominion-game-data \
  --access-mode ReadWrite

# Store the key as a container app secret
az containerapp secret set \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --secrets storage-key="$STORAGE_KEY"
```

### Mounting the volume

Azure Container Apps has no direct CLI flag for volume mounts. Use the Portal or the YAML approach.

#### Portal

1. **Container Apps** → `dominion-clone-server` → **Application** → **Containers**
2. Click **Edit and deploy**
3. Select the container → **Volume mounts** tab
4. Add a mount: volume `dominion-game-data`, mount path `/app/server/game-data`
5. Click **Save** and then **Create** to deploy a new revision

#### CLI (YAML)

```bash
# Export current config
az containerapp show \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  -o yaml > /tmp/server-app.yaml

# Patch volumes and volumeMounts into the YAML
python3 patch-volume.py

# Apply
az containerapp update \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --yaml /tmp/server-app-updated.yaml
```

Where `patch-volume.py` adds the following to the exported YAML:

```python
app['properties']['template']['volumes'] = [{
    'name': 'game-data-volume',
    'storageName': 'dominion-game-data',
    'storageType': 'AzureFile'
}]
app['properties']['template']['containers'][0]['volumeMounts'] = [{
    'volumeName': 'game-data-volume',
    'mountPath': '/app/server/game-data'
}]
```

See [Microsoft docs](https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts-azure-files) for the full reference.

### Backup Considerations

- The KV store file (`auth.kv`) is self-contained — copy it to back up all sessions and user accounts.
- To rotate the auth store (force all users to re-login), delete the store file and restart.
- Sessions only contain auth metadata (token, username, IP, timestamps). No game state is stored here.

## Content Security Policy

The Nginx frontend container sends a `Content-Security-Policy` header (and companion security headers) on every response. The policy is generated dynamically by `docker/env.sh` at container start so the `connect-src` directive can include the runtime `WS_HOST` value without rebuilding the image.

### How it works

`docker/env.sh` writes `/etc/nginx/conf.d/security-headers.conf` during container initialisation. `docker/nginx.conf` includes that file in the `server` block via:

```nginx
include /etc/nginx/conf.d/security-headers.conf;
```

The generated file contains:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' <WS_HOST> <WS_CONNECT_SRC>; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
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
curl -si https://dominion.turkeysunite.com/index.html | grep -i "content-security\|x-content-type\|referrer\|permissions"
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
| `AZURE_FRONTEND_HOSTNAME` | `dominion.turkeysunite.com` |
| `AZURE_CONTAINER_APP_ENVIRONMENT` | `dominion-clone-env` |

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

This happens when deploying with the `:latest` tag (same image reference string = no new revision). The deploy workflow uses SHA tags to avoid this. For manual updates, always use a specific tag.

### Site unreachable with ERR_CONNECTION_RESET after deploy

The custom domain binding was cleared by the deploy action. The deploy workflow automatically rebinds it, but if it failed or was skipped, run:

```bash
az containerapp hostname bind \
  --name dominion-clone-frontend \
  --resource-group turkeysunite \
  --hostname dominion.turkeysunite.com \
  --environment dominion-clone-env \
  --validation-method CNAME
```

### WebSocket connection fails

- Verify the frontend's `WS_HOST` env var points to the server's FQDN with `https://`
- Azure Container Apps supports WebSocket natively; no special config needed for 1 replica
- For >1 replica, ensure sticky sessions are enabled (see [Scaling](#scaling))

### Login fails with "Unable to reach server"

The frontend container is missing the `WS_HOST` environment variable, so `env.js` defaults to `wsHost: 'http://localhost:3000'` which does not exist in production. All auth HTTP calls (`/auth/login`, `/auth/register`, etc.) use this value as the base URL — nginx does **not** proxy them to the server.

```bash
# Set WS_HOST on the frontend container (creates a new revision)
az containerapp update \
  --name dominion-clone-frontend \
  --resource-group turkeysunite \
  --set-env-vars WS_HOST=https://dominion-clone-server.happyglacier-53482b33.eastus.azurecontainerapps.io
```

After the revision restarts, `env.js` is regenerated with the correct `wsHost` and the CSP `connect-src` directive is updated to include both the HTTPS and WSS forms of the server URL.

### Login rejected with "unknown provider"

The frontend JS cached in the browser is an old version using the removed preset-password auth. Hard refresh (`Ctrl+Shift+R`) or open an incognito window to force the new app to load.

### Server fails to start with `Error: database is locked`

`Deno.openKv()` cannot create a new SQLite database on Azure Files SMB. If startup logs show:

```
[ERROR] [SERVER] startup failed
[ERROR] Error: database is locked
[ERROR]     at async Object.openKv (ext:deno_kv/01_db.ts:9:15)
[ERROR]     at async GameDataKvProvider.open (...)
```

the share is missing a properly initialized `game-data.kv` (or a previous startup attempt left a 0-byte stub there). Diagnose and recover:

```bash
STORAGE_KEY=$(az storage account keys list \
  --account-name turkeysunite --resource-group turkeysunite \
  --query "[0].value" -o tsv)

# Inspect the share — a valid file is ~36 KB; 0 bytes is the broken state
az storage file list \
  --account-name turkeysunite \
  --share-name dominion-game-data \
  --account-key "$STORAGE_KEY" \
  --query "[].{name:name,size:properties.contentLength}" -o table

# If a corrupt 0-byte game-data.kv exists, delete it
az storage file delete \
  --account-name turkeysunite \
  --share-name dominion-game-data \
  --path game-data.kv \
  --account-key "$STORAGE_KEY"
```

Then bootstrap a fresh file following [Game Data KV Bootstrap](#game-data-kv-bootstrap) and restart the failing revision (`az containerapp revision restart ...`).
