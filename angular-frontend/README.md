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

The dev server proxies `/auth`, `/socket.io`, `/debug`, and `/status` requests to the game server at `127.0.0.1:3001` (configured in `src/proxy.conf.json`). When running inside the dev compose stack the alternate `src/proxy.conf.docker.json` is bind-mounted in its place to target the docker-compose service hostname instead.

## Server Connection

The client uses **relative URLs** to talk to the backend. The frontend container's nginx (or the dev server's proxy) is responsible for forwarding `/auth/`, `/socket.io/`, `/debug/`, and `/status` to the game server. `environment.wsHost` controls the base URL prepended to those paths and is resolved at runtime as follows:

1. If `window.__env.wsHost` is set (injected by `env.js`), that value is used.
2. Otherwise it defaults to `http://localhost:3000` (so a non-Dockerised local run works out of the box against a server on that port).

In production, `docker/env.sh` writes `wsHost: ''` so requests stay relative and nginx proxies them; set `WS_HOST_OVERRIDE` to inject a fully-qualified URL into `env.js` only if you want to bypass the nginx proxy entirely.

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
docker build -f docker/DockerFile_web_app -t dominion-web .

# run (nginx on port 80; WS_HOST is the upstream nginx proxies backend paths to)
docker run -d -p 8080:80 -e WS_HOST=http://localhost:3000 dominion-web
```

Then open `http://localhost:8080` in your browser.

### Build Args

| Arg | Default | Description |
|-----|---------|-------------|
| `BUILD_CONFIG` | `production` | Angular build configuration passed to `ng build --configuration` |

Example using the development configuration:

```bash
docker build -f docker/DockerFile_web_app --build-arg BUILD_CONFIG=development -t dominion-web:dev .
```

### Runtime Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_HOST` | `http://localhost:3000` | Upstream backend URL nginx proxies `/auth/`, `/socket.io/`, `/debug/`, and `/status` to. The browser only ever talks to the nginx origin. |
| `WS_HOST_OVERRIDE` | _(unset)_ | Optional. Written verbatim into `env.js` so the bundle issues fully-qualified backend requests instead of relative ones. Only useful when bypassing the nginx proxy. |

`docker/env.sh` runs at container startup and:

1. Writes `env.js` (loaded by `index.html`) with `wsHost: ''` (or `WS_HOST_OVERRIDE` when set), so the Angular app issues relative-URL requests by default.
2. Generates `/etc/nginx/conf.d/proxy-locations.conf` with `proxy_pass` blocks pointing at `WS_HOST`. `nginx.conf` includes that file, so the proxy rules apply without rebuilding the image.
3. Generates `/etc/nginx/conf.d/security-headers.conf` with the CSP and other security headers.

### Example: Custom Server URL

```bash
# nginx forwards /auth, /socket.io, /debug, /status to the IP:port below
docker run -d -p 8080:80 -e WS_HOST=http://192.168.1.100:4000 dominion-web
```
