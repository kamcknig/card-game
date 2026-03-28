# Game Server

Deno TypeScript game server providing Socket.IO-based multiplayer for the Dominion card game.

## Prerequisites

- [Deno](https://deno.land/) (v2+)

## Running Locally

```bash
# install dependencies
npm install

# start with file watch (default port 3001)
deno task dev:watch
```

The server reads an `.env` file automatically when using `deno task dev:watch`. Copy the example to get started:

```bash
cp .env-example .env
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the server listens on |
| `LOG_TO_FILE` | `false` | Enable file-based logging |
| `LOG_FILE_MAX_BYTES` | `5242880` (5 MB) | Max log file size before rotation |
| `LOG_COLOR` | _(unset)_ | Enable colored console log output |
| `GAME_DATA_ROOT` | `./game-data` | Root directory for all persisted runtime data (logs, saved configs) |
| `MATCH_STATE_EXPORT_ENABLED` | `false` | Enable the `/debug/match-state` export endpoint |
| `MATCH_STATE_MERGE_ENABLED` | `false` | Enable the match state merge debug endpoint |
| `MATCH_STATE_PATH` | _(unset)_ | Optional path to a match state file to load on startup |
| `END_MATCH_ON_NO_HUMANS` | `true` | End active matches when all human players disconnect |
| `TOOLTIP_DEFAULT_CLOSE_DELAY_MS` | _(unset)_ | Default delay (ms) before closing tooltips, sent to clients |
| `AUTH_PASSWORD` | _(required)_ | Preset password for simple authentication |

## Other Commands

```bash
# type check
deno check --no-lock src/server.ts

# lint
deno lint src/

# format (uses oxfmt)
deno task fmt

# unit tests
deno task test:unit
```

## Docker

Build and run from the repository root:

```bash
# build
docker build -f docker/DockerFile_server -t dominion-server .

# run (default PORT=3000 inside the container)
docker run -d -p 3000:3000 dominion-server

# run with custom configuration
docker run -d -p 4000:4000 \
  -e PORT=4000 \
  -e LOG_TO_FILE=true \
  -e MATCH_STATE_EXPORT_ENABLED=true \
  dominion-server
```

The container uses `denoland/deno:2.7.7` as its base image and pre-installs dependencies at build time.

### Persisting Data

Game data (logs, saved configurations) is written to `./game-data` inside the container by default. Mount a volume to persist it:

```bash
docker run -d -p 3000:3000 \
  -v $(pwd)/game-data:/app/server/game-data \
  dominion-server
```
