# Unraid Operations Guide

This document covers day-to-day operations for the self-hosted production environment. For architecture overview and CI pipeline details, see the root [README.md](../README.md) and [development.md](development.md#cicd-pipeline).

## Topology

```
Browser
  │  HTTPS
  ▼
Cloudflare edge  →  Cloudflare Tunnel  →  cloudflared container (Unraid, on the `cloudflared` network)
                                              │
                                              ▼
                                     frontend container (nginx + Angular SPA)
                                              │  proxies /auth, /socket.io, /debug, /status
                                              ▼  (Unraid `app` network)
                                       server container (Deno game server)
                                              │
                                              ▼
                                          Supabase (auth + game data)
```

The frontend container publishes no host port — the only path in is through
the Cloudflare tunnel. `docker-compose.unraid.yml` (repo root) is the source
of truth for the container topology, image references, and environment
variables; read it directly rather than trusting a stale copy of the values
below.

## Host Layout

| Path | Contents |
|------|----------|
| Wherever the repo is checked out on the Unraid host | `docker-compose.unraid.yml` (pull-only, no `build:` blocks) |
| Sibling `.env` file (gitignored) | `OWNER`, `SERVER_VERSION`, `FRONTEND_VERSION`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `/mnt/docker/appdata/dominion/game-data` | Bind-mounted match-state exports and game data (see the `server` service's `volumes:` in the compose file) |

GHCR image pulls in `docker-compose.unraid.yml` use `pull_policy: always`, so
`docker compose pull` always fetches the tag currently pinned in `.env`
(falling back to `:latest` when `SERVER_VERSION` / `FRONTEND_VERSION` is
unset).

## Viewing App Status

```bash
docker compose -f docker-compose.unraid.yml ps
docker compose -f docker-compose.unraid.yml logs -f server
docker compose -f docker-compose.unraid.yml logs -f frontend
curl -s https://<your-hostname>/status | jq .
```

`/status` returns overall health, any active issues (e.g.
`SUPABASE_OPEN_FAILED`), the active storage backend, and the running
version — always HTTP 200, with severity conveyed in the JSON body so
monitoring probes can branch on it without treating a degraded state as a
transport failure.

## Rolling Out a Release

Releases are tagged `vX.Y.Z` (a single tag builds and publishes **both**
`ghcr.io/<owner>/dominion-clone-server:X.Y.Z` and
`ghcr.io/<owner>/dominion-clone-frontend:X.Y.Z` from the same CI run — see
[CI/CD Pipeline](development.md#cicd-pipeline)). There is no automatic
deploy step; rolling out on Unraid is manual:

```bash
cd <repo-checkout-on-unraid>
git pull                     # only if docker-compose.unraid.yml changed
$EDITOR .env                 # bump SERVER_VERSION / FRONTEND_VERSION,
                              #   or leave blank to track :latest
docker compose -f docker-compose.unraid.yml pull
docker compose -f docker-compose.unraid.yml up -d
docker compose -f docker-compose.unraid.yml ps
```

## Rollback

Set `SERVER_VERSION` / `FRONTEND_VERSION` in `.env` back to the previous
semver and repeat the pull/up steps above. `docker image ls
ghcr.io/<owner>/dominion-clone-*` shows what's cached locally. Rolling back
from `:latest` requires knowing the previous semver — pin a specific
version in `.env` before any risky deploy so a rollback target is explicit.

## Environment Variables

Server and frontend environment variables are set directly in
`docker-compose.unraid.yml`'s `environment:` blocks (not in `.env` — `.env`
is reserved for image tags and secrets). To add or change one: edit the
compose file, commit, `git pull` on the host, then `docker compose up -d`
to recreate the affected container. See [server/README.md](../server/README.md#environment-variables)
for the full list of server variables and their defaults.

## Secrets

The sibling `.env` file on the Unraid host is the only secret store —
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Rotate by editing `.env`
and running `docker compose up -d` (compose recreates the container with
the new value). No registry credentials are needed to pull images — see
[GHCR Image Management](#ghcr-image-management).

## GHCR Image Management

```bash
gh api /users/<owner>/packages/container/dominion-clone-server/versions
gh api /users/<owner>/packages/container/dominion-clone-frontend/versions
```

Use the GitHub UI (**Packages** tab on the owner's profile) to delete old
image versions. If GHCR pulls ever require authentication (e.g. a package
was flipped to private), `docker compose pull` will fail with `denied` /
`unauthorized` — either make the package public again or configure
`docker login ghcr.io` on the host with a read-scoped PAT.

## Troubleshooting

- **`docker compose pull` fails with `denied` / `manifest unknown`**: the
  image tag in `.env` doesn't exist, or a GHCR package needs its
  visibility checked. Confirm with the `gh api .../versions` calls above.
- **502 / connection refused at the public hostname**: the cloudflared
  container can't reach the frontend — confirm both containers share the
  Docker network named in `docker-compose.unraid.yml` (`docker network
  inspect <network-name>`).
- **WebSocket disconnects**: Socket.IO traffic goes through the Cloudflare
  tunnel and nginx; if you see drops under normal play, check the tunnel's
  ingress timeout settings in the Cloudflare Zero Trust dashboard.
- **`SUPABASE_OPEN_FAILED` in `/status` or server logs**: `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` in `.env` is missing or wrong — fix and
  `docker compose up -d server`.
- **Login fails with "Unable to reach server"**: the frontend's nginx
  proxies `/auth/*` to the `server` compose service internally — this
  usually means the `server` container isn't running or is unhealthy;
  check `docker compose logs server`.

## Initial Account Bootstrap

The server requires at least one user account before anyone can log in.
See [server/README.md](../server/README.md#bootstrap-workflow) for the
full CLI workflow (`deno task auth:users create ...`), which can be run
from any machine with network access to the Supabase project — the server
does not need to be stopped.
