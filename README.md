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

## Docker

Docker images are built from the `docker/` directory. Both Dockerfiles expect to be built from the repository root so they can copy the `shared/`, `server/`, and `angular-frontend/` directories.

### Building Images

```bash
# game server
docker build -f docker/Dockerfile_server -t dominion-server .

# web client
docker build -f docker/Dockerfile_web_app -t dominion-web .
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
