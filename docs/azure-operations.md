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

### Manual Build and Push (skipping CI)

For fast iteration on changes that need a real container build (code path, Dockerfile, dependency change) without waiting for a `master` merge to round-trip through GitHub Actions. Typical end-to-end time is ~2 minutes vs. ~5-10 minutes for the full pipeline.

This bypasses the `Build and Push` workflow but still goes through ACR — Azure Container Apps pulls from ACR regardless of how the image got there.

**Prerequisites** (one-time setup):

```bash
# Authenticate Docker to ACR. Uses your Azure CLI login; no separate creds needed.
az acr login --name turkeysunite
```

**Build, push, and deploy (server):**

```bash
# Build context is the repo root — both Dockerfiles copy from shared/, server/, and angular-frontend/.
# Tag with a recognizable prefix so you can spot manual builds in `az acr repository show-tags`.
TAG=hotfix-$(git rev-parse --short HEAD)

docker build \
  -f docker/DockerFile_server \
  -t turkeysunite.azurecr.io/dominion-clone-server:$TAG \
  .

docker push turkeysunite.azurecr.io/dominion-clone-server:$TAG

az containerapp update \
  --name dominion-clone-server \
  --resource-group turkeysunite \
  --image turkeysunite.azurecr.io/dominion-clone-server:$TAG
```

**Build, push, and deploy (frontend):**

```bash
TAG=hotfix-$(git rev-parse --short HEAD)

docker build \
  -f docker/DockerFile_web_app \
  -t turkeysunite.azurecr.io/dominion-clone-frontend:$TAG \
  .

docker push turkeysunite.azurecr.io/dominion-clone-frontend:$TAG

az containerapp update \
  --name dominion-clone-frontend \
  --resource-group turkeysunite \
  --image turkeysunite.azurecr.io/dominion-clone-frontend:$TAG
```

If the frontend deploy clears the custom domain binding, see [Custom Domain](#custom-domain) for the rebind command.

**Rolling back a manual deploy:** point the container app at any prior tag (e.g. the last release SHA) using the `Manual Update` commands above. Tags from manual builds remain in ACR until pruned — see [ACR Image Management](#acr-image-management) for cleanup.

**When to use the full pipeline instead:** any change you want versioned in `master` and reflected on a tagged release. Manual pushes are for diagnosis and short-lived hotfixes; commit and ship via CI/CD once the change is verified.

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
| `STORAGE_BACKEND` | Unified storage backend — drives both auth (sessions, users) and game data (match-configuration saves). Allowed values: `in-memory` (no persistence, dev/test only) or `supabase` (Postgres tables in a Supabase project). When unset or invalid the server still boots and `/status` reports a `STORAGE_BACKEND_INVALID` error issue (the frontend shows this on `/server-status`) — set this var on every revision. |
| `SUPABASE_URL` | Supabase project URL. Required when `STORAGE_BACKEND=supabase`. Stored as a plain env var (it is not secret). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key. Required when `STORAGE_BACKEND=supabase`. **Always** set this as a Container Apps secret (`secretref:supabase-service-role-key`), never a plain env var — it bypasses RLS and grants full DB access. |
| `AUTH_LOCKOUT_THRESHOLD` | Consecutive failed logins before a user account is locked (per-account, independent of the IP rate limiter). Default: `5`. |
| `AUTH_LOCKOUT_DURATION_MS` | Lockout duration (milliseconds) once the per-account threshold is exceeded. Default: `600000` (10 minutes). |
| `AUTH_MIN_PASSWORD_LENGTH` | Minimum password length enforced at registration and password-change. Default: `10`. |

### Current Frontend Environment Variables

| Variable | Description |
|----------|-------------|
| `WS_HOST` | Full URL of the server Container App that nginx proxies backend requests to (e.g. `https://dominion-clone-server.happyglacier-53482b33.eastus.azurecontainerapps.io`). The frontend nginx runs reverse-proxy `location` blocks for `/auth/`, `/socket.io/`, `/debug/`, and `/status` against this URL — the browser only ever talks to the frontend origin. See [Backend Proxying](#backend-proxying) and [Content Security Policy](#content-security-policy) below. |
| `WS_HOST_OVERRIDE` | Optional. When set, written verbatim into `env.js` so the Angular bundle issues fully-qualified backend requests instead of relative URLs. Only useful when bypassing the nginx proxy (e.g. running the static bundle against a remote backend without nginx). Leave unset in standard deployments. |

## Initial Account Bootstrap

The server requires at least one user account to exist before players can log in. With `STORAGE_BACKEND=supabase`, use the CLI management script to create the first user directly in the Supabase project. The server does not need to be stopped — Supabase writes are immediately visible to the running server.

See [server/README.md](../server/README.md#authentication-usage) for the full HTTP endpoint reference and bootstrap workflow.

### Creating the first user

```bash
cd server
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
STORAGE_BACKEND=supabase \
deno task auth:users create --username <name> --password <pw>
```

Usernames must be 3–32 characters, alphanumeric or underscore. The `create` subcommand refuses to overwrite an existing username. Other `auth:users` subcommands: `delete`, `set-password`, `set-email`, `clear` (run any subcommand with `--help` for its options).

Additional accounts are created via open email-based registration at `POST /auth/register`. Registration codes are no longer required or supported.

## Storage Persistence

The server supports two storage backends, selected via `STORAGE_BACKEND`. Both drive auth (sessions, users) and game data (match-configuration saves) together — splitting them is not supported.

### In-memory (`STORAGE_BACKEND=in-memory`)

When `STORAGE_BACKEND=in-memory`, all state is stored in process memory only. No files are written and no external services are required. All sessions, users, and saved configurations are lost when the process exits. Intended for local development and automated testing only — do not use in production.

### Supabase (`STORAGE_BACKEND=supabase`)

When `STORAGE_BACKEND=supabase`, the server reads and writes Postgres tables in a Supabase project (`auth_users`, `auth_sessions`, `match_configuration_saves`). All user-store reads go directly to the database — there is no in-memory cache. No volume mount is required because state lives in Supabase. Required env vars: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the service-role key must be a Container Apps secret).

Apply the schema once with `supabase db push` against the migration files in `supabase/migrations/`.

If the Supabase project is unreachable at startup, the server still boots and the `/status` endpoint reports an `error`-level `SUPABASE_OPEN_FAILED` issue; the frontend redirects to `/server-status` so users see the failure rather than a blank screen.

### Email confirmation (Supabase backend)

Email confirmation is required for new accounts registered with `STORAGE_BACKEND=supabase`. When a user registers or attaches an email to a legacy account, Supabase automatically sends a "Confirm signup" email. The following dashboard settings must be correct for confirmation emails to work in production.

**Email template**

The confirmation email template lives in the Supabase dashboard under **Authentication → Email Templates → Confirm signup**. Set the subject to `Confirm your email for Dominion` and include a call-to-action link using `{{ .ConfirmationURL }}` in the HTML body. The template is configured per-project in the dashboard; it is not stored in the repository.

**URL configuration**

In the dashboard under **Authentication → URL Configuration**:

- **Site URL**: `https://dominion.turkeysunite.com` — used to construct the confirmation link that is included in the email.
- **Redirect URLs**: add both `https://dominion.turkeysunite.com/login` and `https://dominion.turkeysunite.com/profile/security` so post-confirmation redirects are permitted by Supabase.

**Debugging undelivered confirmation emails**

When a user reports that a confirmation email never arrived, check the following in the Supabase dashboard:

1. **Authentication → Users** — confirm the user row exists and that `email_confirmed_at` is `null`. If the row is missing, the registration call failed before creating the Supabase Auth user.
2. **Authentication → Logs** (or the project's log explorer) — filter for `email` or the user's address to see whether Supabase attempted delivery and what SMTP response it received.
3. If using a custom SMTP provider (**Authentication → Settings → SMTP**), verify the provider credentials and check that the sending domain has valid SPF/DKIM records. Without a custom SMTP provider, Supabase uses its shared sending infrastructure with strict daily limits — switch to a dedicated provider for production workloads with more than a handful of sign-ups per day.

**Legacy user migration**

Existing users (rows with `email = null`) are migrated lazily — they complete an add-email flow at their next login. There is no batch script; the server handles the transition automatically on a per-user basis.

### Azure Files

The `STORAGE_BACKEND=supabase` backend stores all state in the Supabase project — no Azure Files volume mount is required for persistence. The Azure Files share (`dominion-game-data`) was used by the removed `kv` backend and is no longer needed for storage. The server writes logs to `./game-data/logs` inside the container, but these are ephemeral and not mounted.

### Backup Considerations

- With `STORAGE_BACKEND=supabase`, all auth and game data lives in the Supabase project — use Supabase backups or `pg_dump` to back up user accounts and saved configurations.
- To force all users to re-login, delete rows from `auth_sessions` in the Supabase project and restart the server.
- Sessions only contain auth metadata (token, username, IP, timestamps). No game state is stored in the session tables.

## Backend Proxying

The frontend nginx container reverse-proxies all backend-bound paths to the server Container App so the browser only ever talks to the frontend origin. This eliminates cross-origin requests and CORS preflights at runtime.

### How it works

`docker/env.sh` writes `/etc/nginx/conf.d/proxy-locations.conf` at container start, substituting `WS_HOST` into a set of `location` blocks. `docker/nginx.conf` includes that file inside its `server` block, so the generated proxy rules are picked up without rebuilding the image.

Forwarded paths:

| Path | Notes |
|------|-------|
| `/auth/` | Login, register, logout, sessions, change-password, email attachment, availability checks. |
| `/socket.io/` | Socket.IO traffic. nginx is configured with `Upgrade`/`Connection: upgrade` and an extended `proxy_read_timeout` so long-lived WebSocket frames are not dropped. |
| `/debug/` | Server-side debug routes (admin-gated by the backend). |
| `/status` | Server health endpoint. Exact-match so it never collides with the SPA fallback. |

Each generated location sets:

- `proxy_pass ${WS_HOST}` — preserves the request URI when no path is appended.
- `proxy_ssl_server_name on` — required for SNI when `WS_HOST` is HTTPS (which it is on Azure).
- `Host` header rewritten to the backend FQDN so backend host-based routing / TLS sees its own hostname.
- `X-Forwarded-For` and `X-Forwarded-Proto` so the backend can identify the originating client and scheme.

### Frontend-bundle implications

Because nginx handles forwarding, the Angular bundle issues **relative-URL** requests. `docker/env.sh` writes `wsHost: ''` into `env.js` so `${environment.wsHost}/auth/login` becomes `/auth/login`, which the browser sends to the frontend origin and nginx forwards to `WS_HOST` internally. Set `WS_HOST_OVERRIDE` to bypass this and force fully-qualified backend URLs (rare — see the env-vars table).

### Local-vs-production parity

`angular-frontend/src/proxy.conf.json` (and its docker variant `proxy.conf.docker.json`) declare the same forwards for the Angular dev server. Keep both in sync when adding or renaming backend paths.

## Content Security Policy

The Nginx frontend container sends a `Content-Security-Policy` header (and companion security headers) on every response. The policy is generated dynamically by `docker/env.sh` at container start.

### How it works

`docker/env.sh` writes `/etc/nginx/conf.d/security-headers.conf` during container initialisation. `docker/nginx.conf` includes that file in the `server` block via:

```nginx
include /etc/nginx/conf.d/security-headers.conf;
```

The generated file contains:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

`connect-src 'self'` is sufficient because all XHR and WebSocket targets are same-origin (proxied by nginx — see [Backend Proxying](#backend-proxying)). No remote URL needs to be allow-listed in the CSP.

### No additional environment variables required

The CSP is static apart from being regenerated each container start. Set `WS_HOST` for the proxy upstream — that's the only var the frontend container needs.

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

- Verify the frontend's `WS_HOST` env var points to the server's FQDN with `https://` so nginx can resolve the upstream.
- Azure Container Apps supports WebSocket natively; no special config needed for 1 replica.
- For >1 replica, ensure sticky sessions are enabled (see [Scaling](#scaling)).
- Browser DevTools should show Socket.IO connecting to `wss://<frontend-domain>/socket.io/...` — *not* the server FQDN — because nginx proxies the upgrade. If you see a cross-origin URL, `WS_HOST_OVERRIDE` is set or an old image is running (pre-proxy).

### Login fails with "Unable to reach server"

With nginx proxying enabled, `/auth/*` is forwarded same-origin via `proxy-locations.conf`. "Unable to reach server" usually means the proxy upstream is misconfigured. Check, in order:

1. `WS_HOST` is set on the frontend Container App and points to the server's FQDN (HTTPS for Azure Container Apps).
2. The server Container App is reachable from the frontend container (no internal-only ingress restrictions in front of the server).
3. `curl -i https://<frontend-domain>/status` returns the server's status JSON. A `502` indicates the upstream is unreachable; a `404` indicates the running image predates the proxy work and only serves the SPA fallback (rebuild & redeploy).

```bash
# Set WS_HOST on the frontend container (creates a new revision)
az containerapp update \
  --name dominion-clone-frontend \
  --resource-group turkeysunite \
  --set-env-vars WS_HOST=https://dominion-clone-server.happyglacier-53482b33.eastus.azurecontainerapps.io
```

After the revision restarts, `proxy-locations.conf` is regenerated with the new upstream and nginx picks it up immediately.

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

### Server fails to start with Supabase connection error

If startup logs show a Supabase connection failure, verify:

1. `STORAGE_BACKEND=supabase` is set on the container revision.
2. `SUPABASE_URL` is set to the correct project URL.
3. `SUPABASE_SERVICE_ROLE_KEY` is set (as a Container Apps secret) and matches the key in the Supabase dashboard.
4. The Supabase project is online and reachable from the container (check the Supabase status page and project health).

The server still boots when Supabase is unreachable and reports a `SUPABASE_OPEN_FAILED` issue at `/status`. Check the container logs and the `/status` response body for the specific error message.
