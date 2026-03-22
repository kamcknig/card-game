# Web Client

Angular 19 web client for the Dominion card game.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- npm or yarn

## Running Locally

```bash
# install dependencies
npm install

# start dev server (http://localhost:51455)
npm run start
```

The dev server proxies `/socket.io` and `/debug` requests to the game server at `127.0.0.1:3001` (configured in `src/proxy.conf.json`).

## Server Connection

The client connects to the game server via WebSocket. The server URL is resolved at runtime:

1. If `window.__env.wsHost` is set (injected by `env.js`), that value is used.
2. Otherwise it defaults to `http://localhost:3000`.

In local development the proxy handles routing, so the default works out of the box as long as the server is running on port 3001.

## Other Commands

```bash
# type check (preferred validation for routine changes)
npx tsc -p tsconfig.app.json --noEmit

# production build
npm run build

# unit tests (Karma/Jasmine)
npm test
```

## Docker

Build and run from the repository root:

```bash
# build
docker build -f docker/Dockerfile_web_app -t dominion-web .

# run (nginx on port 80, point WS_HOST to the game server)
docker run -d -p 8080:80 -e WS_HOST=http://localhost:3000 dominion-web
```

Then open `http://localhost:8080` in your browser.

### Build Args

| Arg | Default | Description |
|-----|---------|-------------|
| `BUILD_CONFIG` | `production` | Angular build configuration passed to `ng build --configuration` |

Example using the development configuration:

```bash
docker build -f docker/Dockerfile_web_app --build-arg BUILD_CONFIG=development -t dominion-web:dev .
```

### Runtime Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_HOST` | `http://localhost:3000` | WebSocket server URL the client connects to |

The `docker/env.sh` entrypoint script writes `WS_HOST` into `/usr/share/nginx/html/env.js` at container startup, which the Angular app loads via a `<script>` tag in `index.html`.

### Example: Custom Server URL

```bash
docker run -d -p 8080:80 -e WS_HOST=http://192.168.1.100:4000 dominion-web
```
